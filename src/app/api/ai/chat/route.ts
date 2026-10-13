import { getCurrentUser } from "@/lib/auth";
import { runAgent } from "@/lib/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Msg = { role: "user" | "model"; text: string };

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { messages?: Msg[] } | null;
  const messages = (body?.messages ?? []).filter((m) => m && typeof m.text === "string" && m.text.trim()).slice(-14);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "No message" }, { status: 400 });
  }
  const out = await runAgent(user, messages);
  return Response.json(out);
}
