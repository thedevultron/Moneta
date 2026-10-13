import { applicationDefault, cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type {
  DbSession,
  DbUser,
  TableName,
  TableRow,
} from "@/db/json-file";

// Firestore backend for Moneta (Firebase deployment).
// Same shapes as the JSON engine; numeric ids preserved via counters/{table}.
// Accessed ONLY through the firebase-admin SDK server-side (never from the browser).

type Creds = { projectId: string; clientEmail: string; privateKey: string };

function loadCreds(): Creds | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    try {
      const svc = JSON.parse(inline) as { project_id?: string; client_email?: string; private_key?: string };
      if (svc.project_id && svc.client_email && svc.private_key) {
        return { projectId: svc.project_id, clientEmail: svc.client_email, privateKey: svc.private_key };
      }
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    }
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id/client_email/private_key.");
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
    if (!privateKey.includes("BEGIN PRIVATE KEY")) {
      throw new Error("FIREBASE_PRIVATE_KEY doesn't look like a PEM key. Paste the full private_key from the service-account JSON (keep the \\n escapes).");
    }
    return { projectId, clientEmail, privateKey };
  }
  return null;
}

let app: App | null = null;
let misconfigured = "";

export function firestoreStatus(): { configured: boolean; usingEmulator: boolean; error: string } {
  return { configured: !!app || !misconfigured, usingEmulator: !!process.env.FIRESTORE_EMULATOR_HOST, error: misconfigured };
}

function db(): Firestore {
  if (!app) {
    // firebase-admin keeps a GLOBAL app registry shared across module
    // instances (Turbopack dev compiles route handlers and server components
    // separately). Reuse the existing app instead of initializing twice,
    // which throws "Firebase app named [DEFAULT] already exists".
    const existing = getApps();
    if (existing.length > 0) {
      app = getApp();
    } else {
      app = initApp();
    }
  }
  return getFirestore(app);
}

function initApp(): App {
  const creds = loadCreds();
  if (creds) {
    return initializeApp({ credential: cert(creds), projectId: creds.projectId });
  }
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT) {
    // Emulator or GCP ambient credentials (e.g. App Hosting / Cloud Run).
    try {
      return initializeApp({ credential: applicationDefault() });
    } catch {
      return initializeApp();
    }
  }
  misconfigured =
    "Firestore backend selected but no credentials found. Set DB_BACKEND=json, or provide FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (or FIREBASE_SERVICE_ACCOUNT_JSON).";
  throw new Error(misconfigured);
}

const col = (table: TableName) => db().collection(table);

function backfillUser(u: DbUser): DbUser {
  const out = { ...u };
  if (out.aiPersonality === undefined) out.aiPersonality = "calm";
  if (out.thinkingLevel === undefined) out.thinkingLevel = "medium";
  if (out.pinHash === undefined) out.pinHash = null;
  if (out.onboardingComplete === undefined) out.onboardingComplete = true;
  return out;
}

async function readAll<T extends TableName>(table: T): Promise<TableRow[T][]> {
  const snap = await col(table).get();
  const rows = snap.docs.map((d) => d.data() as TableRow[T]);
  if (table === "users") return (rows as unknown as DbUser[]).map(backfillUser) as unknown as TableRow[T][];
  return rows;
}

async function nextId(table: TableName, want?: number): Promise<number> {
  const ref = db().collection("counters").doc(table);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = (snap.data()?.next as number | undefined) ?? 1;
    const id = Math.max(cur, want ?? 0);
    tx.set(ref, { next: id + 1 }, { merge: true });
    return id;
  });
}

export async function all<T extends TableName>(table: T): Promise<TableRow[T][]> {
  return readAll(table);
}

export async function insertRow<T extends TableName>(
  table: T,
  values: Omit<TableRow[T], "id"> & { id?: number },
): Promise<TableRow[T]> {
  if (table === "sessions") throw new Error("Use createSessionRow for sessions.");
  const id = await nextId(table, values.id);
  const created = { ...values, id } as TableRow[T];
  await col(table).doc(String(id)).set(created);
  return created;
}

export async function updateRows<T extends TableName>(
  table: T,
  match: (r: TableRow[T]) => boolean,
  patch: Partial<TableRow[T]>,
): Promise<TableRow[T][]> {
  const rows = await readAll(table);
  const hits = rows.filter(match);
  if (!hits.length) return [];
  const out = hits.map((r) => ({ ...r, ...patch }) as TableRow[T]);
  const writer = db().bulkWriter();
  for (const u of out) {
    const id = (u as { id?: number }).id;
    const token = (u as unknown as { token?: string }).token;
    writer.set(col(table).doc(String(id ?? token)), u as Record<string, unknown>, { merge: false });
  }
  await writer.close();
  return out;
}

export async function deleteRows<T extends TableName>(table: T, match: (r: TableRow[T]) => boolean): Promise<number> {
  const rows = await readAll(table);
  const hits = rows.filter(match);
  if (!hits.length) return 0;
  const writer = db().bulkWriter();
  for (const r of hits) {
    const id = (r as { id?: number }).id;
    const token = (r as unknown as { token?: string }).token;
    writer.delete(col(table).doc(String(id ?? token)));
  }
  await writer.close();
  return hits.length;
}

/**
 * Insert many rows with ONE counter transaction + ONE bulk commit
 * (used by sample-data seeding: hundreds of sequential insertRow calls
 * would each cost 2+ Firestore round-trips and time out).
 */
export async function bulkInsert<T extends TableName>(
  table: T,
  valuesList: (Omit<TableRow[T], "id"> & { id?: number })[],
): Promise<TableRow[T][]> {
  if (!valuesList.length) return [];
  const created = await db().runTransaction(async (tx) => {
    const ref = db().collection("counters").doc(table);
    const snap = await tx.get(ref);
    const cur = (snap.data()?.next as number | undefined) ?? 1;
    // Reserve explicit ids first so auto-assigned ones never collide with them.
    const used = new Set<number>();
    for (const v of valuesList) {
      const id = (v as { id?: number }).id ?? 0;
      if (id > 0) used.add(id);
    }
    const rows = valuesList.map((v) => {
      let id = (v as { id?: number }).id ?? 0;
      if (!(id > 0)) {
        id = cur;
        while (used.has(id)) id++;
      }
      used.add(id);
      return { ...v, id } as TableRow[T];
    });
    // Reserve past every id we used (explicit ids may exceed the counter).
    let maxId = cur;
    for (const id of used) if (id > maxId) maxId = id;
    tx.set(ref, { next: maxId + 1 }, { merge: true });
    return rows;
  });
  const writer = db().bulkWriter();
  for (const r of created) {
    const id = (r as { id?: number }).id;
    const token = (r as unknown as { token?: string }).token;
    writer.set(col(table).doc(String(id ?? token)), r as Record<string, unknown>, { merge: false });
  }
  await writer.close();
  return created;
}

/** Replace whole rows by id with ONE bulk commit (no read per row). */
export async function replaceRows<T extends TableName>(table: T, rows: TableRow[T][]): Promise<TableRow[T][]> {
  if (!rows.length) return [];
  const writer = db().bulkWriter();
  for (const r of rows) {
    const id = (r as { id?: number }).id;
    const token = (r as unknown as { token?: string }).token;
    writer.set(col(table).doc(String(id ?? token)), r as Record<string, unknown>, { merge: false });
  }
  await writer.close();
  return rows;
}

// ---------- users ----------
export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const e = email.trim().toLowerCase();
  const snap = await col("users").where("email", "==", e).limit(1).get();
  if (snap.empty) return null;
  return backfillUser(snap.docs[0].data() as DbUser);
}

export async function findUserById(id: number): Promise<DbUser | null> {
  const snap = await col("users").doc(String(id)).get();
  if (!snap.exists) return null;
  return backfillUser(snap.data() as DbUser);
}

export async function createUser(values: Omit<DbUser, "id" | "createdAt"> & { createdAt?: string }): Promise<DbUser> {
  const existing = await findUserByEmail(values.email);
  if (existing) throw new Error("DUPLICATE_EMAIL");
  const id = await nextId("users");
  const user: DbUser = {
    ...values,
    id,
    email: values.email.trim().toLowerCase(),
    createdAt: values.createdAt ?? new Date().toISOString(),
  };
  await col("users").doc(String(id)).set(user);
  return user;
}

export async function updateUser(id: number, patch: Partial<DbUser>): Promise<DbUser | null> {
  const [row] = await updateRows("users", (u) => u.id === id, patch);
  return row ?? null;
}

export async function deleteUserCascade(id: number) {
  const tables: TableName[] = ["transactions", "budgets", "goals", "recurring", "categories"];
  for (const t of tables) {
    await deleteRows(t, (r) => (r as { userId: number }).userId === id);
  }
  await deleteRows("sessions", (r) => r.userId === id);
  await deleteRows("users", (r) => r.id === id);
}

// ---------- sessions ----------
export async function createSessionRow(token: string, userId: number, expiresAt: string) {
  // Prune expired sessions for this user, then store the new one.
  const snap = await col("sessions").where("userId", "==", userId).get();
  const now = new Date().toISOString();
  const writer = db().bulkWriter();
  for (const d of snap.docs) {
    const s = d.data() as DbSession;
    if (s.expiresAt <= now && s.token !== token) writer.delete(d.ref);
  }
  writer.set(col("sessions").doc(token), { token, userId, expiresAt });
  await writer.close();
}

export async function findSession(token: string): Promise<DbSession | null> {
  const snap = await col("sessions").doc(token).get();
  if (!snap.exists) return null;
  const s = snap.data() as DbSession;
  if (!s || s.expiresAt <= new Date().toISOString()) return null;
  return s;
}

export async function deleteSession(token: string) {
  await col("sessions").doc(token).delete().catch(() => {});
}

// ---------- generic user-scoped helpers ----------
export async function listByUser<T extends "categories" | "transactions" | "budgets" | "goals" | "recurring">(
  table: T,
  userId: number,
): Promise<TableRow[T][]> {
  const snap = await col(table).where("userId", "==", userId).get();
  return snap.docs.map((d) => d.data() as TableRow[T]);
}

export async function healthCheck(): Promise<boolean> {
  try {
    await db().listCollections();
    return true;
  } catch (e) {
    misconfigured = e instanceof Error ? e.message : "Firestore unreachable.";
    return false;
  }
}
