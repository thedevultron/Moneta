import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createSession } from "@/lib/auth";
import { ensureLocalUser } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";

/** OAuth callback: Google (or any provider) → Supabase session → local session. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";
  if (!code) redirect("/login?error=" + encodeURIComponent("Sign-in was cancelled — try again."));
  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) redirect("/login?error=" + encodeURIComponent(error.message));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login?error=" + encodeURIComponent("Couldn't read your account — try again."));
  const local = await ensureLocalUser(
    user.email,
    String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""),
  );
  await createSession(local.id);
  redirect(next);
}
