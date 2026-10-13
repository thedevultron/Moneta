import { getCurrentUser } from "@/lib/auth";
import { hasKey, LIVE_MODEL } from "@/lib/ai";
import { getApiKey } from "@/lib/apikey";

export const dynamic = "force-dynamic";

/**
 * Mint a short-lived Live API token (server holds the real key).
 * Client opens its WebSocket directly to Google with this token.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasKey())) {
    return Response.json({ error: "Live voice needs a valid GEMINI_API_KEY — add one in .env first." }, { status: 400 });
  }
  const now = new Date();
  const body = {
    uses: 1,
    expireTime: new Date(now.getTime() + 30 * 60_000).toISOString(),
    newSessionExpireTime: new Date(now.getTime() + 2 * 60_000).toISOString(),
  };
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": await getApiKey() },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const reason = res.status === 400 && text.includes("API_KEY_INVALID")
        ? "Google rejected GEMINI_API_KEY (API_KEY_INVALID). Create a fresh key at aistudio.google.com/apikey and paste the whole thing into .env."
        : `Token mint failed (${res.status}).`;
      return Response.json({ error: reason }, { status: 400 });
    }
    const j = (await res.json()) as { name?: string; expireTime?: string };
    if (!j.name) return Response.json({ error: "Token mint returned no token." }, { status: 400 });
    return Response.json({
      token: j.name,
      expireTime: j.expireTime,
      model: LIVE_MODEL,
      wsUrl: "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained",
    });
  } catch {
    return Response.json({ error: "Couldn't reach Google to mint a voice token." }, { status: 400 });
  }
}
