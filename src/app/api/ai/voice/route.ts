import { getCurrentUser } from "@/lib/auth";
import { callGemini, hasKey, TRANSCRIBE_MODEL } from "@/lib/ai";
import { runAgent } from "@/lib/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_AUDIO = 8 * 1024 * 1024;

/**
 * Voice turn: client uploads recorded speech → Gemini transcribes it →
 * the transcript runs through the same tool-using agent as chat.
 * Live on-device transcription happens in the browser (Web Speech API);
 * this route is the server fallback + the understanding step.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasKey())) return Response.json({ error: "Voice needs an AI key — add one in Settings → AI key, or type to Coach instead." }, { status: 400 });

  let audio: ArrayBuffer;
  let mime = "audio/webm";
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("audio");
      if (!(file instanceof Blob)) return Response.json({ error: "No audio received" }, { status: 400 });
      if (file.size === 0 || file.size > MAX_AUDIO) return Response.json({ error: "Audio too large" }, { status: 400 });
      mime = file.type || mime;
      audio = await file.arrayBuffer();
    } else {
      const buf = await req.arrayBuffer();
      if (!buf.byteLength || buf.byteLength > MAX_AUDIO) return Response.json({ error: "No audio received" }, { status: 400 });
      mime = ct.split(";")[0] || mime;
      audio = buf;
    }
  } catch {
    return Response.json({ error: "Couldn't read audio" }, { status: 400 });
  }

  const b64 = Buffer.from(audio).toString("base64");
  try {
    const res = await callGemini(
      TRANSCRIBE_MODEL,
      {
        systemInstruction: {
          parts: [{ text: "Transcribe the user's speech exactly, in their language. Return ONLY the transcript as plain text, no quotes, no commentary. If there is no speech, return the single word: NOSPEECH." }],
        },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: b64 } }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
      },
      null,
    );
    const transcript = (res.candidates?.[0]?.content?.parts ?? [])
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("")
      .trim();
    if (!transcript || transcript === "NOSPEECH") {
      return Response.json({ error: "I didn't catch that — try again." }, { status: 400 });
    }
    const out = await runAgent(user, [{ role: "user", text: transcript }]);
    return Response.json({ transcript, ...out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Voice error";
    return Response.json({ error: `Voice failed: ${msg.slice(0, 160)}` }, { status: 400 });
  }
}
