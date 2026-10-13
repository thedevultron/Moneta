import { getCurrentUser } from "@/lib/auth";
import { loadAll } from "@/lib/data";
import { mergeDuplicateCategories } from "@/lib/resources";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const data = await loadAll(user);
  // One-time heal: fold any same-name categories into one so pickers and
  // lists never show repetitive tiles.
  if (await mergeDuplicateCategories(user.id)) {
    return Response.json(await loadAll(user));
  }
  return Response.json(data);
}
