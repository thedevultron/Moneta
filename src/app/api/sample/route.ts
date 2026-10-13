import { deleteRows, updateRows } from "@/db/jsondb";
import { getCurrentUser } from "@/lib/auth";
import { clearUserData, DEFAULT_INCOME_USD, seedSample } from "@/lib/seed";
import { getCurrency } from "@/lib/currency";

export const dynamic = "force-dynamic";

/** Replace the user's data with realistic sample data. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const persona = user.persona === "student" ? "student" : "adult";
  await clearUserData(user.id);
  await deleteRows("categories", (c) => c.userId === user.id);
  await seedSample(user.id, persona, user.currency);
  if (Number(user.monthlyIncome) === 0) {
    await updateRows("users", (u) => u.id === user.id, {
      monthlyIncome: String(Math.round(DEFAULT_INCOME_USD[persona] * getCurrency(user.currency).rate)),
    });
  }
  return Response.json({ ok: true });
}

/** Remove all transactions, budgets, goals and recurring items (keeps categories). */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await clearUserData(user.id);
  return Response.json({ ok: true });
}
