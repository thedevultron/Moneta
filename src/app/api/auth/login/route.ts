import { createSession, findUserByEmail, verifyPassword } from "@/lib/auth";
import { createDemoUser, DEMO_EMAIL, DEMO_PASSWORD, LEGACY_DEMO_EMAIL } from "@/lib/seed";
import { friendlyDbError } from "@/lib/route-errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const email = String(b?.email ?? "").trim().toLowerCase();
  const password = String(b?.password ?? "");
  if (!email || !password) return Response.json({ error: "Enter your email and password" }, { status: 400 });

  try {
    let user = await findUserByEmail(email).catch(() => null);
    if (
      !user &&
      (email === DEMO_EMAIL || email === LEGACY_DEMO_EMAIL) &&
      password === DEMO_PASSWORD
    ) {
      user = await createDemoUser({ email: DEMO_EMAIL, persona: "adult", currency: "USD" });
    }
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return Response.json({ error: "Incorrect email or password" }, { status: 401 });
    }
    await createSession(user.id);
    return Response.json({ ok: true });
  } catch (e) {
    const f = friendlyDbError(e);
    return Response.json({ error: f.error }, { status: f.status });
  }
}
