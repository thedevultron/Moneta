import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase";

/** Browser-side Supabase client (uses the anon/publishable key). */
export const createClient = () => createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
