/** Translate a Supabase Auth error into an honest API response.
 * Supabase errors carry { status, code, message } — pass them through
 * instead of masking everything as a generic 500. */
export function mapSupabaseAuthError(error: { status?: number; code?: string; message: string }): {
  status: number;
  error: string;
} {
  const code = String(error.code ?? "");
  const hay = `${code} ${error.message}`;
  if (/already registered|already exists|user_already_exists/i.test(hay)) {
    return { status: 409, error: "An account with this email already exists" };
  }
  if (error.status === 429 || /rate limit|over_email_send_rate_limit/i.test(hay)) {
    return { status: 429, error: "Email limit reached — wait a few minutes and try again." };
  }
  if (typeof error.status === "number" && [400, 401, 403, 404, 409, 422, 429].includes(error.status)) {
    return { status: error.status, error: error.message };
  }
  // No usable status (network failure etc.) — 400 with the real message
  // still beats a masked 500; the message names the actual cause.
  return { status: 400, error: error.message };
}
