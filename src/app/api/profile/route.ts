import { destroySession, getCurrentUser, hashPassword, publicUser } from "@/lib/auth";
import { deleteUserCascade, updateUser } from "@/db/jsondb";
import { listByUser, replaceRows } from "@/db/jsondb";
import { getCurrency } from "@/lib/currency";
import { isPersonality } from "@/lib/personalities";

export const dynamic = "force-dynamic";

const roundTo = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return Response.json({ error: "Invalid request" }, { status: 400 });
  const set: Partial<{ name: string; persona: string; monthlyIncome: string; currency: string; aiPersonality: string; thinkingLevel: string; pinHash: string | null; onboardingComplete: boolean }> = {};

  if (typeof b.name === "string") {
    const n = b.name.trim().slice(0, 60);
    if (!n) return Response.json({ error: "Name is required" }, { status: 400 });
    set.name = n;
  }
  if (b.persona === "student" || b.persona === "adult") set.persona = b.persona;
  if (b.aiPersonality !== undefined) {
    if (!isPersonality(b.aiPersonality)) return Response.json({ error: "Unknown coach personality" }, { status: 400 });
    set.aiPersonality = b.aiPersonality;
  }
  if (b.thinkingLevel !== undefined) {
    if (!["minimal", "low", "medium", "high"].includes(String(b.thinkingLevel))) {
      return Response.json({ error: "Unknown thinking level" }, { status: 400 });
    }
    set.thinkingLevel = String(b.thinkingLevel);
  }
  if (typeof b.onboardingComplete === "boolean") set.onboardingComplete = b.onboardingComplete;
  if (b.clearPin === true) set.pinHash = null;
  else if (typeof b.pin === "string" && b.pin.length > 0) {
    if (!/^\d{4,6}$/.test(b.pin)) return Response.json({ error: "PIN must be 4–6 digits" }, { status: 400 });
    set.pinHash = hashPassword(`pin:${b.pin}`);
  }
  if (b.monthlyIncome !== undefined) {
    const n = Number(b.monthlyIncome);
    if (!Number.isFinite(n) || n < 0) return Response.json({ error: "Invalid income" }, { status: 400 });
    set.monthlyIncome = String(n);
  }
  if (typeof b.currency === "string" && b.currency !== user.currency) {
    const next = getCurrency(b.currency);
    const prev = getCurrency(user.currency);
    set.currency = next.code;
    if (b.convert) {
      const ratio = next.rate / prev.rate;
      const d = next.decimals;
      // One read + one bulk write per table (per-row updates time out on Firestore).
      const txAll = await listByUser("transactions", user.id);
      await replaceRows(
        "transactions",
        txAll.map((t) => ({ ...t, amount: String(roundTo(Number(t.amount) * ratio, d)) })),
      );
      const bAll = await listByUser("budgets", user.id);
      await replaceRows(
        "budgets",
        bAll.map((x) => ({ ...x, monthlyLimit: String(roundTo(Number(x.monthlyLimit) * ratio, d)) })),
      );
      const gAll = await listByUser("goals", user.id);
      await replaceRows(
        "goals",
        gAll.map((g) => ({
          ...g,
          target: String(roundTo(Number(g.target) * ratio, d)),
          saved: String(roundTo(Number(g.saved) * ratio, d)),
        })),
      );
      const rAll = await listByUser("recurring", user.id);
      await replaceRows(
        "recurring",
        rAll.map((r) => ({ ...r, amount: String(roundTo(Number(r.amount) * ratio, d)) })),
      );
      if (set.monthlyIncome === undefined) {
        set.monthlyIncome = String(roundTo(Number(user.monthlyIncome) * ratio, d));
      }
    }
  }
  if (Object.keys(set).length === 0) return Response.json({ user: publicUser(user) });
  const row = await updateUser(user.id, set);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ user: publicUser(row) });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await deleteUserCascade(user.id);
  await destroySession();
  return Response.json({ ok: true });
}
