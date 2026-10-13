import { dbBackend, healthCheck } from "@/db/jsondb";

export const dynamic = "force-dynamic";

export async function GET() {
  const backend = dbBackend();
  const ok = await healthCheck().catch(() => false);
  if (!ok) return Response.json({ ok: false, store: backend, app: "Moneta" }, { status: 500 });
  return Response.json({ ok: true, store: backend, app: "Moneta" });
}
