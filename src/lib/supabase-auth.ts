import { randomBytes } from "node:crypto";
import { createUser, findUserByEmail, type SessionUser } from "@/lib/auth";
import { seedCategories } from "@/lib/seed";

/**
 * Bridge between Supabase Auth identities and the app's local user rows.
 * Identity lives in Supabase; all money data stays keyed by the local row,
 * so every existing screen, tool, and API keeps working unchanged.
 */
export async function ensureLocalUser(email: string, name: string): Promise<SessionUser> {
  const clean = email.trim().toLowerCase();
  const existing = await findUserByEmail(clean).catch(() => null);
  if (existing) return existing;
  const user = await createUser({
    email: clean,
    name: (name || clean.split("@")[0]).trim().slice(0, 60) || "Moneta user",
    // Unusable random hash — this identity logs in via Supabase, never locally.
    passwordHash: `supabase:${randomBytes(24).toString("hex")}`,
    currency: "USD",
    persona: "adult",
    monthlyIncome: "0",
    isDemo: false,
    aiPersonality: "calm",
    pinHash: null,
    onboardingComplete: false,
    thinkingLevel: "medium",
  });
  // Same starter categories every new account gets.
  await seedCategories(user.id, "adult").catch(() => {});
  return user;
}
