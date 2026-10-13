import { getCurrentUser } from "@/lib/auth";
import { AGENT_MODEL, hasKey, LITE_MODEL, LIVE_MODEL, TRANSCRIBE_MODEL } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** Public-to-app config for voice/AI features (key itself stays server side). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({
    hasKey: await hasKey(),
    liveModel: LIVE_MODEL,
    liteModel: LITE_MODEL,
    agentModel: AGENT_MODEL,
    transcribeModel: TRANSCRIBE_MODEL,
    speechRecognition: true,
  });
}
