/** Map known infrastructure failures to friendly API errors (surfaced verbatim in the UI). */
export function friendlyDbError(e: unknown): { status: number; error: string } {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/RESOURCE_EXHAUSTED|quota exceeded/i.test(msg)) {
    return {
      status: 503,
      error:
        "Database quota exceeded (Firestore free limit) — viewing still works, but saving is paused until it resets. To keep working now, switch to local storage: set data/backend.json to {\"backend\":\"json\"} and restart the server.",
    };
  }
  return { status: 500, error: "Something went wrong. Please try again." };
}
