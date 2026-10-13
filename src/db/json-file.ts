import { promises as fs } from "node:fs";
import path from "node:path";

// JSON text-file storage for Moneta (local PC hosting).
// Each table is a human-readable text document in ./data/*.json.
// Single-user PC host: read-modify-write with atomic rename is sufficient.

export type DbUser = {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  currency: string;
  monthlyIncome: string;
  persona: string;
  isDemo: boolean;
  createdAt: string;
  /** Coach personality: calm | hype | strict | playful */
  aiPersonality: string;
  /** Coach thinking level: minimal | low | medium | high */
  thinkingLevel: string;
  /** scrypt PIN hash (same format as passwords), null = no PIN lock */
  pinHash: string | null;
  /** false until the onboarding wizard is finished */
  onboardingComplete: boolean;
};

export type DbSession = { token: string; userId: number; expiresAt: string };

export type DbCategory = {
  id: number;
  userId: number;
  name: string;
  icon: string;
  color: string;
  kind: string;
};

export type DbTransaction = {
  id: number;
  userId: number;
  categoryId: number | null;
  type: string;
  amount: string;
  note: string;
  date: string;
  createdAt: string;
};

export type DbBudget = { id: number; userId: number; categoryId: number; monthlyLimit: string };
export type DbGoal = {
  id: number;
  userId: number;
  name: string;
  icon: string;
  target: string;
  saved: string;
  deadline: string | null;
};
export type DbRecurring = {
  id: number;
  userId: number;
  categoryId: number | null;
  name: string;
  amount: string;
  dayOfMonth: number;
  active: boolean;
};

export type TableName = "users" | "sessions" | "categories" | "transactions" | "budgets" | "goals" | "recurring";

export type TableRow = {
  users: DbUser;
  sessions: DbSession;
  categories: DbCategory;
  transactions: DbTransaction;
  budgets: DbBudget;
  goals: DbGoal;
  recurring: DbRecurring;
};

export function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

const cache = new Map<TableName, unknown[]>();
const writeLocks = new Map<TableName, Promise<void>>();

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function load<T extends TableName>(table: T): Promise<TableRow[T][]> {
  // Single-user PC host: always read through from disk. Files are tiny and
  // this makes stale in-memory state (e.g. after external edits) impossible.
  await ensureDir();
  const file = path.join(dataDir(), `${table}.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as TableRow[T][];
    const rows = Array.isArray(parsed) ? parsed : [];
    if (table === "users") backfillUsers(rows as unknown as DbUser[]);
    cache.set(table, rows);
    return rows;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      cache.set(table, []);
      return [] as TableRow[T][];
    }
    throw e;
  }
}

/** Backfill new user fields for accounts created before Phase 2 (existing users skip onboarding). */
function backfillUsers(rows: DbUser[]) {
  let dirty = false;
  for (const u of rows) {
    if (u.aiPersonality === undefined) { u.aiPersonality = "calm"; dirty = true; }
    if (u.thinkingLevel === undefined) { u.thinkingLevel = "medium"; dirty = true; }
    if (u.pinHash === undefined) { u.pinHash = null; dirty = true; }
    if (u.onboardingComplete === undefined) { u.onboardingComplete = true; dirty = true; }
  }
  if (dirty) {
    const file = path.join(dataDir(), "users.json");
    fs.writeFile(file, JSON.stringify(rows, null, 2) + "\n", "utf8").catch(() => {});
  }
}

async function save<T extends TableName>(table: T, rows: TableRow[T][]) {
  cache.set(table, rows);
  await ensureDir();
  const file = path.join(dataDir(), `${table}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rows, null, 2) + "\n", "utf8");
  await fs.rename(tmp, file);
}

// Serialize writes per table to avoid lost updates on rapid double-clicks.
function queued<T extends TableName>(table: T, fn: () => Promise<void>): Promise<void> {
  const prev = writeLocks.get(table) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeLocks.set(table, next.then(() => undefined));
  return next;
}

function nextId(rows: { id: number }[]): number {
  let max = 0;
  for (const r of rows) if (r.id > max) max = r.id;
  return max + 1;
}

export async function all<T extends TableName>(table: T): Promise<TableRow[T][]> {
  return [...(await load(table))];
}

export async function insertRow<T extends TableName>(
  table: T,
  values: Omit<TableRow[T], "id"> & { id?: number },
): Promise<TableRow[T]> {
  let created!: TableRow[T];
  await queued(table, async () => {
    const rows = await load(table);
    const id = values.id ?? nextId(rows as { id: number }[]);
    created = { ...values, id } as TableRow[T];
    await save(table, [...rows, created]);
  });
  return created;
}

export async function updateRows<T extends TableName>(
  table: T,
  match: (r: TableRow[T]) => boolean,
  patch: Partial<TableRow[T]>,
): Promise<TableRow[T][]> {
  let out: TableRow[T][] = [];
  await queued(table, async () => {
    const rows = await load(table);
    const next = rows.map((r) => {
      if (!match(r)) return r;
      const u = { ...r, ...patch } as TableRow[T];
      out.push(u);
      return u;
    });
    await save(table, next);
  });
  return out;
}

export async function deleteRows<T extends TableName>(table: T, match: (r: TableRow[T]) => boolean): Promise<number> {
  let n = 0;
  await queued(table, async () => {
    const rows = await load(table);
    const next = rows.filter((r) => {
      if (match(r)) {
        n++;
        return false;
      }
      return true;
    });
    await save(table, next);
  });
  return n;
}

/** Insert many rows in ONE queued write (used by sample-data seeding). */
export async function bulkInsert<T extends TableName>(
  table: T,
  valuesList: (Omit<TableRow[T], "id"> & { id?: number })[],
): Promise<TableRow[T][]> {
  if (!valuesList.length) return [];
  let created: TableRow[T][] = [];
  await queued(table, async () => {
    const rows = await load(table);
    let next = nextId(rows as { id: number }[]);
    const used = new Set((rows as { id: number }[]).map((r) => r.id));
    created = valuesList.map((v) => {
      let id = v.id ?? 0;
      if (!(id > 0) || used.has(id)) {
        while (used.has(next)) next++;
        id = next++;
      }
      used.add(id);
      return { ...v, id } as TableRow[T];
    });
    await save(table, [...rows, ...created]);
  });
  return created;
}

/** Replace whole rows by id in ONE queued write (no read per row). */
export async function replaceRows<T extends TableName>(table: T, rows: TableRow[T][]): Promise<TableRow[T][]> {
  if (!rows.length) return [];
  await queued(table, async () => {
    const current = await load(table);
    const byId = new Map(rows.map((r) => [(r as { id?: number }).id ?? (r as unknown as { token?: string }).token, r]));
    const next = current.map((r) => {
      const key = (r as { id?: number }).id ?? (r as unknown as { token?: string }).token;
      return byId.get(key) ?? r;
    });
    await save(table, next);
  });
  return rows;
}

// ---------- users ----------
export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const rows = await load("users");
  const e = email.trim().toLowerCase();
  return rows.find((u) => u.email === e) ?? null;
}

export async function findUserById(id: number): Promise<DbUser | null> {
  const rows = await load("users");
  return rows.find((u) => u.id === id) ?? null;
}

export async function createUser(values: Omit<DbUser, "id" | "createdAt"> & { createdAt?: string }): Promise<DbUser> {
  return insertRow("users", { ...values, email: values.email.trim().toLowerCase(), createdAt: values.createdAt ?? new Date().toISOString() });
}

export async function updateUser(id: number, patch: Partial<DbUser>): Promise<DbUser | null> {
  const [row] = await updateRows("users", (u) => u.id === id, patch);
  return row ?? null;
}

export async function deleteUserCascade(id: number) {
  await deleteRows("transactions", (r) => r.userId === id);
  await deleteRows("budgets", (r) => r.userId === id);
  await deleteRows("goals", (r) => r.userId === id);
  await deleteRows("recurring", (r) => r.userId === id);
  await deleteRows("categories", (r) => r.userId === id);
  await deleteRows("sessions", (r) => r.userId === id);
  await deleteRows("users", (r) => r.id === id);
}

// ---------- sessions ----------
export async function createSessionRow(token: string, userId: number, expiresAt: string) {
  await queued("sessions", async () => {
    const rows = await load("sessions");
    await save("sessions", [...rows.filter((s) => s.expiresAt > new Date().toISOString()), { token, userId, expiresAt }]);
  });
}

export async function findSession(token: string): Promise<DbSession | null> {
  const rows = await load("sessions");
  const s = rows.find((x) => x.token === token) ?? null;
  if (!s || s.expiresAt <= new Date().toISOString()) return null;
  return s;
}

export async function deleteSession(token: string) {
  await deleteRows("sessions", (s) => s.token === token);
}

// ---------- generic user-scoped helpers ----------
export async function listByUser<T extends "categories" | "transactions" | "budgets" | "goals" | "recurring">(
  table: T,
  userId: number,
): Promise<TableRow[T][]> {
  const rows = await load(table);
  return (rows as (TableRow[T] & { userId: number })[]).filter((r) => r.userId === userId);
}

export async function healthCheck(): Promise<boolean> {
  try {
    await ensureDir();
    await load("users");
    return true;
  } catch {
    return false;
  }
}
