import { readFileSync } from "node:fs";
import path from "node:path";
import * as json from "@/db/json-file";
import * as fsdb from "@/db/firestore";

// Storage facade: JSON text files by default, Firestore when configured.
// DB_BACKEND=firestore selects Firestore; anything else (or missing creds
// with a clear error) uses local JSON. All call sites keep working unchanged.
export type {
  DbBudget,
  DbCategory,
  DbGoal,
  DbRecurring,
  DbSession,
  DbTransaction,
  DbUser,
  TableName,
  TableRow,
} from "@/db/json-file";

let backendCache: "firestore" | "json" | null = null;

export function dbBackend(): "firestore" | "json" {
  // File flag wins (immune to bundler env-inlining and stale processes):
  // data/backend.json containing {"backend":"firestore"}.
  if (!backendCache) {
    try {
      const raw = readFileSync(path.join(process.cwd(), "data", "backend.json"), "utf8");
      backendCache = JSON.parse(raw).backend === "firestore" ? "firestore" : "json";
    } catch {
      backendCache = process.env.DB_BACKEND === "firestore" ? "firestore" : "json";
    }
  }
  return backendCache;
}

/** Force re-read of the backend selection (used after switching). */
export function resetBackendCache() {
  backendCache = null;
}

export function dataDir(): string {
  return json.dataDir();
}

export const all: typeof json.all = ((...a: Parameters<typeof json.all>) =>
  (dbBackend() === "firestore" ? fsdb.all(...a) : json.all(...a)) as never) as typeof json.all;

export const insertRow: typeof json.insertRow = ((...a: Parameters<typeof json.insertRow>) =>
  (dbBackend() === "firestore" ? fsdb.insertRow(...a) : json.insertRow(...a)) as never) as typeof json.insertRow;

export const updateRows: typeof json.updateRows = ((...a: Parameters<typeof json.updateRows>) =>
  (dbBackend() === "firestore" ? fsdb.updateRows(...a) : json.updateRows(...a)) as never) as typeof json.updateRows;

export const deleteRows: typeof json.deleteRows = ((...a: Parameters<typeof json.deleteRows>) =>
  (dbBackend() === "firestore" ? fsdb.deleteRows(...a) : json.deleteRows(...a)) as never) as typeof json.deleteRows;

export const bulkInsert: typeof json.bulkInsert = ((...a: Parameters<typeof json.bulkInsert>) =>
  (dbBackend() === "firestore" ? fsdb.bulkInsert(...a) : json.bulkInsert(...a)) as never) as typeof json.bulkInsert;

export const replaceRows: typeof json.replaceRows = ((...a: Parameters<typeof json.replaceRows>) =>
  (dbBackend() === "firestore" ? fsdb.replaceRows(...a) : json.replaceRows(...a)) as never) as typeof json.replaceRows;

export const findUserByEmail: typeof json.findUserByEmail = (...a) =>
  dbBackend() === "firestore" ? fsdb.findUserByEmail(...a) : json.findUserByEmail(...a);

export const findUserById: typeof json.findUserById = (...a) =>
  dbBackend() === "firestore" ? fsdb.findUserById(...a) : json.findUserById(...a);

export const createUser: typeof json.createUser = (...a) =>
  dbBackend() === "firestore" ? fsdb.createUser(...a) : json.createUser(...a);

export const updateUser: typeof json.updateUser = (...a) =>
  dbBackend() === "firestore" ? fsdb.updateUser(...a) : json.updateUser(...a);

export const deleteUserCascade: typeof json.deleteUserCascade = (...a) =>
  dbBackend() === "firestore" ? fsdb.deleteUserCascade(...a) : json.deleteUserCascade(...a);

export const createSessionRow: typeof json.createSessionRow = (...a) =>
  dbBackend() === "firestore" ? fsdb.createSessionRow(...a) : json.createSessionRow(...a);

export const findSession: typeof json.findSession = (...a) =>
  dbBackend() === "firestore" ? fsdb.findSession(...a) : json.findSession(...a);

export const deleteSession: typeof json.deleteSession = (...a) =>
  dbBackend() === "firestore" ? fsdb.deleteSession(...a) : json.deleteSession(...a);

export const listByUser: typeof json.listByUser = ((...a: Parameters<typeof json.listByUser>) =>
  (dbBackend() === "firestore" ? fsdb.listByUser(...a) : json.listByUser(...a)) as never) as typeof json.listByUser;

export const healthCheck: typeof json.healthCheck = () =>
  dbBackend() === "firestore" ? fsdb.healthCheck() : json.healthCheck();
