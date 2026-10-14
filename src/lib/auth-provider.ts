import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  createSessionRow,
  deleteSession,
  findSession,
  findUserById,
  type DbUser,
} from "@/db/jsondb";

export const SESSION_COOKIE = "moneta_session";
// Stay signed in until the user signs out (effectively a year; the row is
// deleted on explicit sign-out, and Firestore persists it across deploys).
const SESSION_DAYS = 365;

export type SessionUser = DbUser;

export interface AuthProvider {
  hashPassword(password: string): string;
  verifyPassword(password: string, stored: string): boolean;
  createSession(userId: number): Promise<void>;
  destroySession(): Promise<void>;
  getCurrentUser(): Promise<SessionUser | null>;
}

export class LocalAuthProvider implements AuthProvider {
  hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  }

  verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const test = scryptSync(password, salt, 64);
    const known = Buffer.from(hash, "hex");
    return known.length === test.length && timingSafeEqual(known, test);
  }

  async createSession(userId: number): Promise<void> {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
    await createSessionRow(token, userId, expiresAt);
    const jar = await cookies();
    // Self-hosted on a PC (localhost + Cloudflare tunnel): the Node backend itself
    // always sees plain HTTP, so `secure: true` would make browsers silently drop
    // the session cookie and sign-in would never stick. Keep it false; the token
    // is 256-bit random + HttpOnly + Lax, and the tunnel encrypts browser traffic.
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      expires: new Date(expiresAt),
    });
  }

  async destroySession(): Promise<void> {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) await deleteSession(token).catch(() => {});
    jar.delete(SESSION_COOKIE);
  }

  async getCurrentUser(): Promise<SessionUser | null> {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await findSession(token).catch(() => null);
    if (!session) return null;
    return (await findUserById(session.userId).catch(() => null)) ?? null;
  }
}

/**
 * Future Firebase Auth migration path.
 *
 * Intended design (not yet wired up):
 * - Client signs in with the Firebase Auth JS SDK (email/password, Google, …)
 *   and sends the ID token to the server (Authorization: Bearer <idToken>).
 * - Server verifies it with firebase-admin: `getAuth(app).verifyIdToken(idToken)`
 *   and maps the Firebase UID to a local DbUser row (e.g. via users.firebaseUid).
 * - Sessions could then be stateless (verified per request) or bridged back
 *   into the existing session-cookie table. Until then every method throws.
 */
export class FirebaseAuthProvider implements AuthProvider {
  private notConfigured(): Error {
    return new Error(
      "FirebaseAuthProvider is not configured. Set up Firebase Auth client + firebase-admin (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_JSON), then implement verifyIdToken via getAuth(app).verifyIdToken(idToken).",
    );
  }

  hashPassword(_password: string): string {
    // Passwords are hashed by Firebase Auth server-side; never stored locally.
    throw this.notConfigured();
  }

  verifyPassword(_password: string, _stored: string): boolean {
    // Verification happens via Firebase Auth sign-in / verifyIdToken, not scrypt.
    throw this.notConfigured();
  }

  async createSession(_userId: number): Promise<void> {
    // TODO: verify ID token via firebase-admin getAuth().verifyIdToken(),
    // upsert/match the DbUser by firebaseUid, then issue the session cookie.
    throw this.notConfigured();
  }

  async destroySession(): Promise<void> {
    // TODO: revoke refresh tokens via getAuth().revokeRefreshTokens(uid)
    // and clear the session cookie.
    throw this.notConfigured();
  }

  async getCurrentUser(): Promise<SessionUser | null> {
    // TODO: read the Firebase ID token (cookie or Authorization header),
    // verify via getAuth().verifyIdToken(idToken), look up DbUser by firebaseUid.
    throw this.notConfigured();
  }
}

export class SupabaseAuthProvider extends LocalAuthProvider {
  async destroySession(): Promise<void> {
    // Sign out of the Supabase cookie session too (SSR client), then local.
    try {
      const { cookies } = await import("next/headers");
      const { createClient } = await import("@/utils/supabase/server");
      const supabase = createClient(await cookies());
      await supabase.auth.signOut().catch(() => {});
    } catch {}
    await super.destroySession();
  }

  async getCurrentUser(): Promise<SessionUser | null> {
    // Prefer a verified Supabase session; fall back to the local cookie so
    // legacy (pre-Supabase) logins keep working unchanged.
    try {
      const { cookies } = await import("next/headers");
      const { createClient } = await import("@/utils/supabase/server");
      const supabase = createClient(await cookies());
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (user?.email) {
        const { findUserByEmail } = await import("@/db/jsondb");
        const dbUser = await findUserByEmail(user.email).catch(() => null);
        if (dbUser) return dbUser;
      }
    } catch {}

    return super.getCurrentUser();
  }
}

function resolveAuthProvider(): AuthProvider {
  const backend = process.env.AUTH_BACKEND?.toLowerCase();
  if (backend === "supabase") return new SupabaseAuthProvider();
  if (backend === "firebase") return new FirebaseAuthProvider();
  return new LocalAuthProvider();
}

let provider: AuthProvider = resolveAuthProvider();

/** Swap the active auth backend. */
export function setProvider(p: AuthProvider): void {
  provider = p;
}

export function getProvider(): AuthProvider {
  const backend = process.env.AUTH_BACKEND?.toLowerCase();
  if (backend === "supabase" && !(provider instanceof SupabaseAuthProvider)) {
    provider = new SupabaseAuthProvider();
  } else if (backend === "firebase" && !(provider instanceof FirebaseAuthProvider)) {
    provider = new FirebaseAuthProvider();
  }
  return provider;
}

export function authBackend(): "local" | "firebase" | "supabase" {
  const backend = process.env.AUTH_BACKEND?.toLowerCase();
  if (backend === "supabase") return "supabase";
  if (backend === "firebase") return "firebase";
  return "local";
}

