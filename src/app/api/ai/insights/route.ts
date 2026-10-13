import { getCurrentUser } from "@/lib/auth";
import { loadAll } from "@/lib/data";
import { callGemini, hasKey, LITE_MODEL } from "@/lib/ai";
import { buildContext, localTips, type Tip } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const data = await loadAll(user);
  const fallback = localTips(data);
  if (!(await hasKey()) || data.transactions.length === 0) {
    return Response.json({ tips: fallback, mode: "local" });
  }
  try {
    const res = await callGemini(
      LITE_MODEL,
      {
        systemInstruction: {
          parts: [
            {
              text: "You are a sharp personal-finance coach. From the user's data, write exactly 4 specific, quantified ways to reduce spending or save more. Reference real categories/merchants. Each tip: title (max 6 words), body (max 28 words, plain text), saving (estimated monthly saving as a number in the user's currency). Respond ONLY with JSON: an array of {title, body, saving}.",
            },
          ],
        },
        contents: [{ role: "user", parts: [{ text: buildContext(data) }] }],
        generationConfig: { temperature: 0.6, responseMimeType: "application/json", maxOutputTokens: 1024 },
      },
      "minimal",
    );
    const raw = res.candidates?.[0]?.content?.parts?.map((p) => (typeof p.text === "string" ? p.text : "")).join("") ?? "";
    const parsed = JSON.parse(raw.replace(/^```json|```$/g, "").trim()) as Tip[];
    const tips = parsed
      .filter((t) => t && typeof t.title === "string" && typeof t.body === "string")
      .slice(0, 5)
      .map((t) => ({ title: t.title, body: t.body, saving: Number.isFinite(Number(t.saving)) ? Math.round(Number(t.saving)) : undefined }));
    if (!tips.length) throw new Error("empty");
    return Response.json({ tips, mode: "gemini" });
  } catch {
    return Response.json({ tips: fallback, mode: "local" });
  }
}
