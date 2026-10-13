// Local JSON-file DB entrypoint. Replaces the previous Postgres/Drizzle pool.
// All data lives in human-readable text documents under ./data/*.json.
export * from "@/db/jsondb";
