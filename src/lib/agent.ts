import { loadAll } from "@/lib/data";
import {
  AGENT_MODEL,
  type ActionResult,
  callGemini,
  type Content,
  hasKey,
  personalityLine,
  runTool,
  SYSTEM_PROMPT,
  thinkingFor,
  TOOLS,
} from "@/lib/ai";
import { buildContext, localTips } from "@/lib/stats";
import { formatMoney } from "@/lib/currency";
import type { SessionUser } from "@/lib/auth";

export type AgentMsg = { role: "user" | "model"; text: string };
export type AgentResult = { reply: string; actions: ActionResult[]; mode: string; notice?: string };

/** Full Gemini agent with function tools. Falls back to the local agent without a key. */
export async function runAgent(user: SessionUser, messages: AgentMsg[]): Promise<AgentResult> {
  const clean = messages.filter((m) => m && typeof m.text === "string" && m.text.trim()).slice(-14);
  if (!clean.length || clean[clean.length - 1].role !== "user") {
    return { reply: "Say that once more?", actions: [], mode: "local" };
  }
  const actions: ActionResult[] = [];
  if (!(await hasKey())) return localAgent(user, clean[clean.length - 1].text, actions);

  try {
    const data = await loadAll(user);
    const contents: Content[] = clean.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
    const system = `${SYSTEM_PROMPT}\n${personalityLine(user)}\n\n--- USER DATA ---\n${buildContext(data)}`;
    let reply = "";
    let currentUser = user;
    for (let round = 0; round < 6; round++) {
      const res = await callGemini(
        AGENT_MODEL,
        {
          systemInstruction: { parts: [{ text: system }] },
          contents,
          tools: TOOLS,
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        },
        thinkingFor(user),
      );
      const content = res.candidates?.[0]?.content;
      if (!content?.parts?.length) {
        reply = reply || "I couldn't come up with an answer — could you rephrase that?";
        break;
      }
      const calls = content.parts.filter((p) => p.functionCall) as { functionCall: { name: string; args?: Record<string, unknown> } }[];
      const text = content.parts
        .filter((p) => typeof p.text === "string" && !p.thought)
        .map((p) => p.text as string)
        .join("");
      if (!calls.length) {
        reply = text;
        break;
      }
      contents.push({ role: "model", parts: content.parts });
      const responses: Record<string, unknown>[] = [];
      for (const c of calls) {
        const r = await runTool(currentUser, c.functionCall.name, c.functionCall.args ?? {});
        actions.push(r);
        // Profile/income changes affect formatting + later rounds: refetch so the
        // next tool call and confirmation use the real, freshly-saved user row.
        if (r.ok && (c.functionCall.name === "update_profile" || c.functionCall.name === "set_monthly_income")) {
          try {
            const { findUserById } = await import("@/lib/auth");
            const fresh = await findUserById(currentUser.id);
            if (fresh) currentUser = fresh;
          } catch {}
        }
        responses.push({
          functionResponse: { name: c.functionCall.name, response: { ok: r.ok, result: r.summary } },
        });
      }
      contents.push({ role: "user", parts: responses });
      if (text) reply = text;
    }
    return { reply: reply || "Done.", actions, mode: "gemini" };
  } catch (e) {
    // Key present but rejected (or network down): stay useful via the local agent.
    const fb = await localAgent(user, clean[clean.length - 1].text, actions);
    const msg = e instanceof Error ? e.message : "AI error";
    const hint = msg.includes("400") || msg.includes("403") || msg.includes("API key")
      ? " (Your GEMINI_API_KEY was rejected — get a valid one from https://aistudio.google.com/apikey.)"
      : " (AI service unreachable — showing local analysis instead.)";
    return { ...fb, notice: `${fb.notice ?? ""}${hint}`.trim() };
  }
}

/** Offline fallback so the coach is still useful without an API key. */
async function localAgent(user: SessionUser, text: string, actions: ActionResult[]): Promise<AgentResult> {
  const t = text.toLowerCase();
  const note = "Add an AI key in Settings → AI key to enable the full AI coach with deeper reasoning.";
  const addM = t.match(/(?:add|log|spent|spend|paid|bought)\s+(?:an?\s+)?(?:[^\d\s]{0,3})?(\d+(?:\.\d+)?)\s*(?:[a-z]{3}\s+)?(?:on|for|at)?\s*(.*)/);
  if (addM) {
    const r = await runTool(user, "add_transaction", { type: "expense", amount: Number(addM[1]), note: (addM[2] || "Expense").replace(/[.!]$/, "").trim() || "Expense", category_name: /lunch|dinner|breakfast|coffee|cafe|café|pizza|food|snack|meal/.test(t) ? "Dining" : /uber|taxi|bus|train|fuel|petrol|gas|metro/.test(t) ? "Transport" : "Other" });
    actions.push(r);
    return { reply: r.ok ? "Done — I've logged that for you." : `I couldn't do that: ${r.summary}`, actions, mode: "local", notice: note };
  }
  const incM = t.match(/income.*?(\d+(?:\.\d+)?)/);
  if (incM && /(set|change|update|make)/.test(t)) {
    const r = await runTool(user, "set_monthly_income", { amount: Number(incM[1]) });
    actions.push(r);
    return { reply: "Your monthly income is updated.", actions, mode: "local", notice: note };
  }
  const data = await loadAll(user);
  const tips = localTips(data);
  const total = tips.reduce((a, x) => a + (x.saving ?? 0), 0);
  const reply =
    `Here's what stands out in your numbers:\n\n` +
    tips.map((x) => `- **${x.title}.** ${x.body}`).join("\n") +
    (total ? `\n\nTogether these could free up about **${formatMoney(total, user.currency, { decimals: false })}** per month.` : "");
  return { reply, actions, mode: "local", notice: note };
}
