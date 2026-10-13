import {
  getProvider,
  SESSION_COOKIE,
  type AuthProvider,
  type SessionUser,
} from "@/lib/auth-provider";

export { SESSION_COOKIE };
export type { SessionUser };
export type { AuthProvider };

// Thin delegation layer: all auth behavior lives in the provider
// (src/lib/auth-provider.ts) so a future FirebaseAuthProvider can be
// swapped in via setProvider() without touching call sites.
export function hashPassword(password: string): string {
  return getProvider().hashPassword(password);
}

export function verifyPassword(password: string, stored: string): boolean {
  return getProvider().verifyPassword(password, stored);
}

export async function createSession(userId: number) {
  return getProvider().createSession(userId);
}

export async function destroySession() {
  return getProvider().destroySession();
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return getProvider().getCurrentUser();
}

export function publicUser(u: SessionUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    currency: u.currency,
    monthlyIncome: Number(u.monthlyIncome),
    persona: u.persona as "student" | "adult",
    isDemo: u.isDemo,
    aiPersonality: u.aiPersonality || "calm",
    thinkingLevel: ["minimal", "low", "medium", "high"].includes(u.thinkingLevel) ? u.thinkingLevel : "medium",
    hasPin: !!u.pinHash,
    onboardingComplete: u.onboardingComplete !== false,
  };
}

export { createUser, deleteUserCascade, findUserByEmail, findUserById } from "@/db/jsondb";
export { findUserById as getUserById } from "@/db/jsondb";
