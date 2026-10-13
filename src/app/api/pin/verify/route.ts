import { getCurrentUser, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Verify the app PIN (scrypt-hashed server side, never compared client side). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.pinHash) return Response.json({ ok: true, noPin: true });
  const b = (await req.json().catch(() => null)) as { pin?: unknown } | null;
  const pin = String(b?.pin ?? "");
  if (!/^\d{4,6}$/.test(pin)) return Response.json({ error: "Enter your PIN" }, { status: 400 });
  if (!verifyPassword(`pin:${pin}`, user.pinHash)) {
    return Response.json({ error: "Wrong PIN — try again" }, { status: 401 });
  }
  return Response.json({ ok: true });
}
