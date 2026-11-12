import { cookies } from "next/headers";
import { createSession, findUserByEmail, verifyPassword } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ensureLocalUser } from "@/lib/supabase-auth";
import { createClient } from "@/utils/supabase/server";
import { createDemoUser, DEMO_EMAIL, DEMO_PASSWORD, LEGACY_DEMO_EMAIL } from "@/lib/seed";
import { friendlyDbError } from "@/lib/route-errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const email = String(b?.email ?? "").trim().toLowerCase();
  const password = String(b?.password ?? "");
  if (!email || !password) return Response.json({ error: "Enter your email and password" }, { status: 400 });

  // Supabase-native sign-in first (sessions land in Supabase cookies too).
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient(await cookies());
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.user?.email) {
        try {
          const user = await ensureLocalUser(
            data.user.email,
            String(data.user.user_metadata?.full_name ?? ""),
          );
          await createSession(user.id);
          return Response.json({ ok: true });
        } catch (e) {
          // Supabase accepted the credentials but local bridging failed
          // (storage down, etc.) — report that, don't pretend the password
          // was wrong by falling through to the legacy check.
          return Response.json(
            { error: e instanceof Error ? e.message : "Sign-in bridging failed" },
            { status: 500 },
          );
        }
      }
      // Correct password but inbox link not clicked yet: say so directly
      // instead of the misleading "incorrect password" below.
      const code = String((error as { code?: string } | undefined)?.code ?? "");
      if (/email_not_confirmed/i.test(code + " " + (error?.message ?? ""))) {
        return Response.json(
          { error: "Email not confirmed yet — click the link in your inbox, then sign in." },
          { status: 403 },
        );
      }
      // Wrong password / unknown identity → legacy path below.
    } catch {
      // Supabase unreachable → legacy path below.
    }
  }

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
