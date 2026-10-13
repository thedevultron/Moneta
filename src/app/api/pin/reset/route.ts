import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { updateUser } from "@/db/jsondb";

export const dynamic = "force-dynamic";

/** Remove the app PIN after re-entering the account password (forgot-PIN recovery). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = String(b?.password ?? "");
  if (!password) return Response.json({ error: "Enter your password" }, { status: 400 });
  if (!verifyPassword(password, user.passwordHash)) {
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }
  await updateUser(user.id, { pinHash: null });
  return Response.json({ ok: true });
}
