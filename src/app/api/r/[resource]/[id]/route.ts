import { getCurrentUser } from "@/lib/auth";
import { deleteItem, getResource, updateItem } from "@/lib/resources";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ resource: string; id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { resource, id } = await ctx.params;
  const cfg = getResource(resource);
  const nid = Number(id);
  if (!cfg || !Number.isInteger(nid)) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const built = await cfg.build(body, true, user.id);
  if ("error" in built) return Response.json({ error: built.error }, { status: 400 });
  if (Object.keys(built.values).length === 0) return Response.json({ error: "Nothing to update" }, { status: 400 });
  const row = await updateItem(resource as "transactions", user.id, nid, built.values);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ item: cfg.ser(row as never) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { resource, id } = await ctx.params;
  const cfg = getResource(resource);
  const nid = Number(id);
  if (!cfg || !Number.isInteger(nid)) return Response.json({ error: "Not found" }, { status: 404 });
  await deleteItem(resource as "transactions", user.id, nid);
  return Response.json({ ok: true });
}
