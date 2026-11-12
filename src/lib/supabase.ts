import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

/**
 * Read an env var and strip surrounding quotes. `.env` files are commonly
 * pasted as KEY="value"; Next's loader removes the quotes, but values set
 * through other dashboards/scripts sometimes keep them, and a quoted URL
 * makes `new URL()` throw inside middleware (Netlify: "Edge function crashed").
 */
function env(name: string): string {
  const raw = process.env[name] ?? "";
  return raw.trim().replace(/^["']|["']$/g, "").trim();
}

export function getSupabaseUrl(): string {
  return env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  // Accept both the legacy ANON_KEY name and the newer PUBLISHABLE_KEY
  // name from Supabase docs snippets — same value, either var works.
  return (
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    env("SUPABASE_ANON_KEY")
  );
}

export function getSupabaseServiceRoleKey(): string {
  return env("SUPABASE_SERVICE_ROLE_KEY");
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/** Client using anon public key for client or standard requests. */
export function getSupabase(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return client;
}

/** Admin client using service role key when available (bypasses RLS). */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey() || getSupabaseAnonKey();
  if (!url || !serviceKey) return null;
  if (!adminClient) {
    adminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return adminClient;
}
