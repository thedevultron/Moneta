import { getCurrentUser } from "@/lib/auth";
import { createItem, findBudget, getResource, setBudgetLimit } from "@/lib/resources";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ resource: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { resource } = await ctx.params;
  const cfg = getResource(resource);
  if (!cfg) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const built = await cfg.build(body, false, user.id);
  if ("error" in built) return Response.json({ error: built.error }, { status: 400 });

  // budgets are unique per category: upsert
  if (resource === "budgets") {
    const existing = await findBudget(user.id, Number(built.values.categoryId));
    if (existing) {
      const row = await setBudgetLimit(existing.id, String(built.values.monthlyLimit));
      return Response.json({ item: cfg.ser(row as never) });
    }
  }

  // create requires name for categories/goals/recurring — validate here
  if ((resource === "categories" || resource === "goals" || resource === "recurring") && !built.values.name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const row = await createItem(resource as "transactions", user.id, built.values);
  return Response.json({ item: cfg.ser(row as never) });
}
