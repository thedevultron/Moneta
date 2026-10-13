import { getCurrentUser } from "@/lib/auth";
import { clearApiKey, getApiKey, keySource, setApiKey, validateKey } from "@/lib/apikey";

export const dynamic = "force-dynamic";

/** Which key is active (in-app override wins over .env) + masked preview. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [source, key] = await Promise.all([keySource(), getApiKey()]);
  return Response.json({
    source,
    preview: key ? `••••${key.slice(-4)}` : null,
    length: key.length,
  });
}

/** Validate with Google first — only a Google-accepted key gets saved. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { key?: unknown } | null;
  const key = String(b?.key ?? "").trim();
  if (!key) return Response.json({ error: "Paste a key first." }, { status: 400 });
  const v = await validateKey(key);
  if (!v.ok) return Response.json({ error: v.message }, { status: 400 });
  await setApiKey(key);
  return Response.json({ ok: true, message: v.message });
}

/** Remove the in-app override (falls back to .env). */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await clearApiKey();
  return Response.json({ ok: true });
}
