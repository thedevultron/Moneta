import { getCurrentUser } from "@/lib/auth";
import { runTool } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** Execute one Coach function tool (used by Live voice sessions). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { name?: unknown; args?: unknown } | null;
  const name = String(b?.name ?? "");
  const args = (b?.args ?? {}) as Record<string, unknown>;
  if (!name) return Response.json({ error: "No tool" }, { status: 400 });
  const fresh = await getCurrentUser();
  const result = await runTool(fresh ?? user, name, args);
  return Response.json(result);
}
