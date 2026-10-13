import { getCurrentUser } from "@/lib/auth";
import { loadAll } from "@/lib/data";
import { buildContext } from "@/lib/stats";

export const dynamic = "force-dynamic";

/** Live financial context for the Live voice session's system instruction. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const data = await loadAll(user);
  return Response.json({
    context: buildContext(data),
    name: data.user.name,
    currency: data.user.currency,
    persona: data.user.persona,
    aiPersonality: data.user.aiPersonality,
    thinkingLevel: data.user.thinkingLevel,
  });
}
