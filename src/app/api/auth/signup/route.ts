import { cookies } from "next/headers";
import { createSession, createUser, findUserByEmail, hashPassword } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ensureLocalUser } from "@/lib/supabase-auth";
import { createClient } from "@/utils/supabase/server";
import { getCurrency } from "@/lib/currency";
import { DEFAULT_INCOME_USD, seedCategories, seedSample } from "@/lib/seed";
import { friendlyDbError } from "@/lib/route-errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return Response.json({ error: "Invalid request" }, { status: 400 });
  const name = String(b.name ?? "").trim().slice(0, 60);
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const persona = b.persona === "student" ? "student" : "adult";
  const currency = getCurrency(String(b.currency ?? "USD")).code;
  if (!name) return Response.json({ error: "Please enter your name" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  if (password.length < 6) return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });

  const existing = await findUserByEmail(email).catch(() => null);
  if (existing) return Response.json({ error: "An account with this email already exists" }, { status: 409 });

  // Supabase-native identity when configured (users appear in the dashboard).
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient(await cookies());
      const origin = new URL(req.url).origin;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          // After clicking the inbox link, Supabase sends them here —
          // the form shows "confirmed, sign in".
          emailRedirectTo: `${origin}/login?confirmed=1`,
        },
      });
      if (error) {
        if (/already registered|already exists/i.test(error.message)) {
          return Response.json({ error: "An account with this email already exists" }, { status: 409 });
        }
        throw new Error(error.message);
      }
      if (data.session?.user?.email) {
        // Instant session (email confirmation off): bridge + sign in now.
        const user = await ensureLocalUser(data.session.user.email, name);
        if (b.sample) await seedSample(user.id, persona, currency);
        await createSession(user.id);
        return Response.json({ ok: true });
      }
      // Email confirmation on: no session yet — user clicks the inbox link,
      // then signs in (bridge runs on first login).
      return Response.json({ ok: true, checkEmail: true });
    } catch (e) {
      const f = friendlyDbError(e);
      return Response.json({ error: f.error }, { status: f.status });
    }
  }

  try {
    const income = b.sample ? Math.round(DEFAULT_INCOME_USD[persona] * getCurrency(currency).rate) : 0;
    const user = await createUser({
      email, name, passwordHash: hashPassword(password), currency, persona, monthlyIncome: String(income), isDemo: false,
      aiPersonality: "calm", pinHash: null, onboardingComplete: false, thinkingLevel: "medium",
    });
    if (b.sample) await seedSample(user.id, persona, currency);
    else await seedCategories(user.id, persona);
    await createSession(user.id);
    return Response.json({ ok: true });
  } catch (e) {
    const f = friendlyDbError(e);
    return Response.json({ error: f.error }, { status: f.status });
  }
}
