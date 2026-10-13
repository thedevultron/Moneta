import { randomBytes } from "node:crypto";
import { createSession } from "@/lib/auth";
import { getCurrency } from "@/lib/currency";
import { cleanupDemos, createDemoUser } from "@/lib/seed";
import { friendlyDbError } from "@/lib/route-errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const persona = b.persona === "student" ? "student" : "adult";
  const currency = getCurrency(String(b.currency ?? "USD")).code;
  try {
    await cleanupDemos().catch(() => {});
    const user = await createDemoUser({
      email: `demo-${randomBytes(5).toString("hex")}@demo.moneta.app`,
      persona,
      currency,
    });
    await createSession(user.id);
    return Response.json({ ok: true });
  } catch (e) {
    const f = friendlyDbError(e);
    return Response.json({ error: f.error }, { status: f.status });
  }
}
