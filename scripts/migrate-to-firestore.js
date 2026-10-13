/**
 * Copy local data/*.json into Firestore (one-time migration).
 * Usage (PowerShell):
 *   $env:DB_BACKEND="firestore"
 *   $env:FIREBASE_PROJECT_ID="your-project"
 *   $env:FIREBASE_CLIENT_EMAIL="svc@your-project.iam.gserviceaccount.com"
 *   $env:FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *   node scripts/migrate-to-firestore.js [--dry-run]
 *
 * Keeps the SAME numeric ids, then sets counters/{table} so new rows continue.
 * Safe to re-run: existing doc ids are overwritten with identical content.
 */
const fs = require("node:fs");
const path = require("node:path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const DRY = process.argv.includes("--dry-run");
const TABLES = ["users", "sessions", "categories", "transactions", "budgets", "goals", "recurring"];

function creds() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return {
      projectId: svc.project_id,
      cert: {
        projectId: svc.project_id,
        clientEmail: svc.client_email,
        privateKey: svc.private_key,
      },
    };
  }
  let pk = process.env.FIREBASE_PRIVATE_KEY || "";
  if (pk.includes("\\n")) pk = pk.replace(/\\n/g, "\n");
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    cert: { projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: pk },
  };
}

const main = async () => {
  // Scan local files first (works without credentials for --dry-run).
  const Tables = [];
  for (const table of TABLES) {
    const file = path.join(__dirname, "..", "data", `${table}.json`);
    let rows = [];
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Array.isArray(parsed)) rows = parsed;
    } catch {}
    Tables.push({ table, rows });
  }
  const total = Tables.reduce((a, t) => a + t.rows.length, 0);
  console.log(`Local data: ${total} docs across ${Tables.filter((t) => t.rows.length).length} tables.`);
  if (DRY) {
    for (const { table, rows } of Tables) {
      if (rows.length) console.log(`${table}: ${rows.length} docs (would write)`);
    }
    console.log("DRY RUN done (nothing written, no credentials needed).");
    process.exit(0);
  }
  const { projectId, cert: certObj } = creds();
  if (!certObj.projectId || !certObj.clientEmail || !certObj.privateKey) {
    throw new Error("Missing Firebase credentials env (see header).");
  }
  initializeApp({ credential: cert(certObj), projectId });
  const db = getFirestore();
  console.log("Target project:", projectId, DRY ? "(DRY RUN)" : "");

  for (const table of TABLES) {
    const file = path.join(__dirname, "..", "data", `${table}.json`);
    let rows = [];
    try {
      rows = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      console.log(`${table}: no local file, skipped`);
      continue;
    }
    if (!Array.isArray(rows) || !rows.length) {
      console.log(`${table}: empty, skipped`);
      continue;
    }
    let maxId = 0;
    const chunks = [];
    let batch = db.batch();
    let n = 0;
    const flush = async () => {
      if (n === 0) return;
      if (!DRY) await batch.commit();
      chunks.push(n);
      batch = db.batch();
      n = 0;
    };
    for (const row of rows) {
      const key = row.id !== undefined ? String(row.id) : row.token;
      if (row.id !== undefined && row.id > maxId) maxId = row.id;
      batch.set(db.collection(table).doc(String(key)), row, { merge: false });
      if (++n >= 400) await flush();
    }
    await flush();
    if (!DRY && maxId > 0) {
      await db.collection("counters").doc(table).set({ next: maxId + 1 }, { merge: true });
    }
    console.log(`${table}: ${rows.length} docs${maxId ? `, counter -> ${maxId + 1}` : ""}`);
  }
  console.log(DRY ? "DRY RUN done (nothing written)." : "Migration done. Set DB_BACKEND=firestore on the server and restart.");
  process.exit(0);
};

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
