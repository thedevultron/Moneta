import { deleteRows, insertRow, listByUser, replaceRows, updateRows } from "@/db/jsondb";
import { getApiKey } from "@/lib/apikey";
import { formatMoney } from "@/lib/currency";
import { isoDate } from "@/lib/stats";
import type { SessionUser } from "@/lib/auth";

export const AGENT_MODEL = process.env.GEMINI_AGENT_MODEL || "gemini-3.5-flash-lite";
export const LITE_MODEL = process.env.GEMINI_LITE_MODEL || "gemini-3.5-flash-lite";
// Voice / Live API model — extended-thinking variant for high-reasoning voice.
export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live-extended-thinking";
// Speech-to-text model for server-side voice transcription fallback.
export const TRANSCRIBE_MODEL = process.env.GEMINI_TRANSCRIBE_MODEL || "gemini-3.1-flash-lite";
export const THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL || "medium";

/** Thinking level for a user: their preference wins, else the server default. */
export function thinkingFor(user: { thinkingLevel?: string }): string {
  const v = user.thinkingLevel || THINKING_LEVEL;
  return ["minimal", "low", "medium", "high"].includes(v) ? v : THINKING_LEVEL;
}

export const hasKey = async () => Boolean(await getApiKey());

type Part = Record<string, unknown>;
export type Content = { role: "user" | "model"; parts: Part[] };

export async function callGemini(model: string, body: Record<string, unknown>, thinking: string | null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const attempt = async (withThinking: boolean) => {
    const gen = { ...(body.generationConfig as object) } as Record<string, unknown>;
    if (withThinking && thinking) gen.thinkingConfig = { thinkingLevel: thinking };
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": await getApiKey() },
      body: JSON.stringify({ ...body, generationConfig: gen }),
    });
  };
  let res = await attempt(true);
  if (!res.ok && res.status === 400 && thinking) res = await attempt(false);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as {
    candidates?: { content?: Content; finishReason?: string }[];
  };
}

const PALETTE = ["#847dff", "#00b3dd", "#dd90d8", "#90b8f0", "#cc9166", "#d1c9ff", "#8fb8a0"];

async function findOrCreateCategory(userId: number, name: string | undefined, kind: "expense" | "income") {
  if (!name) return null;
  const all = await listByUser("categories", userId);
  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const n = norm(name);
  if (!n) return null;
  const hit =
    all.find((c) => norm(c.name) === n) ||
    all.find((c) => norm(c.name).includes(n) || n.includes(norm(c.name)));
  if (hit) return hit;
  const row = await insertRow("categories", {
    userId, name: name.trim().replace(/\s+/g, " ").slice(0, 32), icon: "wallet", color: PALETTE[all.length % PALETTE.length], kind,
  });
  return row;
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v));

export type ActionResult = { tool: string; ok: boolean; summary: string; navigate?: string };

/** Tool names that must never execute — account destruction / session termination. */
export const DENYLIST = ["delete_account", "delete_user", "sign_out", "logout", "signout"];

function isDeniedTool(name: string): boolean {
  const lower = name.toLowerCase();
  if (DENYLIST.some((d) => lower.includes(d))) return true;
  if (lower.includes("delete_user")) return true;
  // Any account-destroying variant (delete/remove/destroy + account).
  if (lower.includes("account") && (lower.includes("delete") || lower.includes("remove") || lower.includes("destroy"))) return true;
  return false;
}

const ALLOWED_DESTINATIONS = ["/app", "/app/transactions", "/app/budgets", "/app/goals", "/app/recurring", "/app/reports", "/app/categories", "/app/settings", "/app/more", "/app/ai"];

export async function runTool(user: SessionUser, name: string, a: Record<string, unknown>): Promise<ActionResult> {
  if (isDeniedTool(name)) {
    return { tool: name, ok: false, summary: `Not permitted: I can never delete accounts, sign out, or log out users. ${name} was blocked with no side effects.` };
  }
  const cur = user.currency;
  const fm = (v: number) => formatMoney(v, cur);
  const uid = user.id;
  try {
    switch (name) {
      case "add_transaction": {
        const type = a.type === "income" ? "income" : "expense";
        const amt = n(a.amount);
        if (!(amt > 0)) throw new Error("Invalid amount");
        const cat = await findOrCreateCategory(uid, a.category_name as string | undefined, type);
        const date = /^\d{4}-\d{2}-\d{2}$/.test(String(a.date)) ? String(a.date) : isoDate(new Date());
        const row = await insertRow("transactions", {
          userId: uid, type, amount: String(amt), note: String(a.note ?? "").slice(0, 120), categoryId: cat?.id ?? null, date,
          createdAt: new Date().toISOString(),
        });
        return { tool: name, ok: true, summary: `Added ${type} ${fm(amt)} — ${row.note}${cat ? ` (${cat.name})` : ""}` };
      }
      case "update_transaction": {
        const set: Record<string, unknown> = {};
        if (a.amount !== undefined) set.amount = String(n(a.amount));
        if (a.note !== undefined) set.note = String(a.note).slice(0, 120);
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(a.date))) set.date = String(a.date);
        if (a.category_name) {
          const cat = await findOrCreateCategory(uid, String(a.category_name), "expense");
          set.categoryId = cat?.id ?? null;
        }
        const rows = await updateRows("transactions", (t) => t.id === n(a.id) && t.userId === uid, set as never);
        const row = rows[0];
        if (!row) throw new Error("Transaction not found");
        return { tool: name, ok: true, summary: `Updated "${row.note}" → ${fm(Number(row.amount))}` };
      }
      case "delete_transaction": {
        const all = await listByUser("transactions", uid);
        const target = all.find((t) => t.id === n(a.id));
        if (!target) throw new Error("Transaction not found");
        await deleteRows("transactions", (t) => t.id === target.id && t.userId === uid);
        return { tool: name, ok: true, summary: `Deleted "${target.note}" (${fm(Number(target.amount))})` };
      }
      case "set_monthly_income": {
        const amt = n(a.amount);
        if (!(amt >= 0)) throw new Error("Invalid amount");
        await updateRows("users", (u) => u.id === uid, { monthlyIncome: String(amt) });
        return { tool: name, ok: true, summary: `Monthly income set to ${fm(amt)}` };
      }
      case "set_budget": {
        const amt = n(a.monthly_limit);
        if (!(amt > 0)) throw new Error("Invalid limit");
        const cat = await findOrCreateCategory(uid, String(a.category_name), "expense");
        if (!cat) throw new Error("Category required");
        const ex = (await listByUser("budgets", uid)).find((b) => b.categoryId === cat.id);
        if (ex) await updateRows("budgets", (b) => b.id === ex.id, { monthlyLimit: String(amt) });
        else await insertRow("budgets", { userId: uid, categoryId: cat.id, monthlyLimit: String(amt) });
        return { tool: name, ok: true, summary: `Budget for ${cat.name}: ${fm(amt)}/month` };
      }
      case "remove_budget": {
        const cat = await findOrCreateCategory(uid, String(a.category_name), "expense");
        if (!cat) throw new Error("Category not found");
        await deleteRows("budgets", (b) => b.userId === uid && b.categoryId === cat.id);
        return { tool: name, ok: true, summary: `Removed budget for ${cat.name}` };
      }
      case "create_goal": {
        const target = n(a.target);
        if (!(target > 0)) throw new Error("Invalid target");
        await insertRow("goals", {
          userId: uid,
          name: String(a.name).slice(0, 48),
          icon: "piggy-bank",
          target: String(target),
          saved: String(a.saved !== undefined ? n(a.saved) : 0),
          deadline: /^\d{4}-\d{2}-\d{2}$/.test(String(a.deadline)) ? String(a.deadline) : null,
        });
        return { tool: name, ok: true, summary: `Created goal "${a.name}" — ${fm(target)}` };
      }
      case "contribute_to_goal": {
        const all = await listByUser("goals", uid);
        const q = String(a.goal_name).toLowerCase();
        const g = all.find((x) => x.name.toLowerCase() === q) || all.find((x) => x.name.toLowerCase().includes(q));
        if (!g) throw new Error("Goal not found");
        const amt = n(a.amount);
        if (!(amt > 0)) throw new Error("Invalid amount");
        await updateRows("goals", (x) => x.id === g.id, { saved: String(Number(g.saved) + amt) });
        return { tool: name, ok: true, summary: `Added ${fm(amt)} to "${g.name}"` };
      }
      case "withdraw_from_goal": {
        const all = await listByUser("goals", uid);
        const q = String(a.goal_name ?? "").toLowerCase();
        const g = all.find((x) => x.name.toLowerCase() === q) || all.find((x) => x.name.toLowerCase().includes(q));
        if (!g) throw new Error("Goal not found");
        const amt = n(a.amount);
        if (!(amt > 0)) throw new Error("Invalid amount");
        const left = Math.max(Number(g.saved) - amt, 0);
        await updateRows("goals", (x) => x.id === g.id, { saved: String(left) });
        return { tool: name, ok: true, summary: `Withdrew ${fm(Math.min(amt, Number(g.saved)))} from "${g.name}" (${fm(left)} left)` };
      }
      case "update_goal": {
        const all = await listByUser("goals", uid);
        const q = String(a.goal_name ?? "").toLowerCase();
        const g = all.find((x) => x.name.toLowerCase() === q) || all.find((x) => x.name.toLowerCase().includes(q));
        if (!g) throw new Error("Goal not found");
        const set: Record<string, unknown> = {};
        const notes: string[] = [];
        if (a.name !== undefined && String(a.name).trim()) {
          set.name = String(a.name).trim().slice(0, 48);
          notes.push(`renamed to "${set.name}"`);
        }
        if (a.target !== undefined) {
          const t = n(a.target);
          if (!(t > 0)) throw new Error("Invalid target");
          set.target = String(t);
          notes.push(`target → ${fm(t)}`);
        }
        if (a.saved !== undefined) {
          const s = n(a.saved);
          if (!Number.isFinite(s) || s < 0) throw new Error("Invalid saved amount");
          set.saved = String(s);
          notes.push(`saved → ${fm(s)}`);
        }
        if (a.deadline !== undefined) {
          const d = String(a.deadline).trim();
          set.deadline = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
          notes.push(d && set.deadline ? `deadline → ${d}` : "deadline cleared");
        }
        if (!Object.keys(set).length) throw new Error("Nothing to update — provide name, target, saved, or deadline");
        const [row] = await updateRows("goals", (x) => x.id === g.id, set as never);
        if (!row) throw new Error("Goal not found");
        return { tool: name, ok: true, summary: `Updated goal "${g.name}"${notes.length ? `: ${notes.join(", ")}` : ""}` };
      }
      case "delete_goal": {
        const all = await listByUser("goals", uid);
        const q = String(a.goal_name ?? "").toLowerCase();
        const g = all.find((x) => x.name.toLowerCase() === q) || all.find((x) => x.name.toLowerCase().includes(q));
        if (!g) throw new Error("Goal not found");
        await deleteRows("goals", (x) => x.id === g.id && x.userId === uid);
        return { tool: name, ok: true, summary: `Deleted goal "${g.name}"` };
      }
      case "add_recurring": {
        const amt = n(a.amount);
        if (!(amt > 0)) throw new Error("Invalid amount");
        const cat = await findOrCreateCategory(uid, a.category_name as string | undefined, "expense");
        const day = Math.min(31, Math.max(1, Math.round(n(a.day_of_month) || 1)));
        await insertRow("recurring", { userId: uid, name: String(a.name).slice(0, 48), amount: String(amt), dayOfMonth: day, categoryId: cat?.id ?? null, active: true });
        return { tool: name, ok: true, summary: `Added recurring "${a.name}" ${fm(amt)} on day ${day}` };
      }
      case "update_recurring": {
        const all = await listByUser("recurring", uid);
        const q = String(a.name ?? "").toLowerCase();
        const r = all.find((x) => x.name.toLowerCase() === q) || all.find((x) => x.name.toLowerCase().includes(q));
        if (!r) throw new Error("Recurring bill not found");
        const set: Record<string, unknown> = {};
        const notes: string[] = [];
        if (a.new_name !== undefined && String(a.new_name).trim()) {
          set.name = String(a.new_name).trim().slice(0, 48);
          notes.push(`renamed to "${set.name}"`);
        }
        if (a.amount !== undefined) {
          const amt = n(a.amount);
          if (!(amt > 0)) throw new Error("Invalid amount");
          set.amount = String(amt);
          notes.push(`amount → ${fm(amt)}`);
        }
        if (a.day_of_month !== undefined) {
          const day = Math.min(31, Math.max(1, Math.round(n(a.day_of_month))));
          if (!Number.isFinite(day)) throw new Error("Invalid day");
          set.dayOfMonth = day;
          notes.push(`day → ${day}`);
        }
        if (a.active !== undefined) {
          set.active = a.active === true || a.active === "true";
          notes.push(set.active ? "resumed" : "paused");
        }
        if (a.category_name !== undefined && String(a.category_name).trim()) {
          const cat = await findOrCreateCategory(uid, String(a.category_name), "expense");
          set.categoryId = cat?.id ?? null;
          notes.push(`category → ${cat?.name ?? "Other"}`);
        }
        if (!Object.keys(set).length) throw new Error("Nothing to update — provide new_name, amount, day_of_month, active, or category_name");
        const [row] = await updateRows("recurring", (x) => x.id === r.id, set as never);
        if (!row) throw new Error("Recurring bill not found");
        return { tool: name, ok: true, summary: `Updated recurring "${r.name}"${notes.length ? `: ${notes.join(", ")}` : ""}` };
      }
      case "delete_recurring": {
        const all = await listByUser("recurring", uid);
        const q = String(a.name ?? "").toLowerCase();
        const r = all.find((x) => x.name.toLowerCase() === q) || all.find((x) => x.name.toLowerCase().includes(q));
        if (!r) throw new Error("Recurring bill not found");
        await deleteRows("recurring", (x) => x.id === r.id && x.userId === uid);
        return { tool: name, ok: true, summary: `Deleted recurring "${r.name}"` };
      }
      case "log_recurring_payment": {
        const all = await listByUser("recurring", uid);
        const q = String(a.name ?? "").toLowerCase();
        const r = all.find((x) => x.name.toLowerCase() === q) || all.find((x) => x.name.toLowerCase().includes(q));
        if (!r) throw new Error("Recurring bill not found");
        const date = /^\d{4}-\d{2}-\d{2}$/.test(String(a.date)) ? String(a.date) : isoDate(new Date());
        const row = await insertRow("transactions", {
          userId: uid, type: "expense", amount: String(r.amount), note: String(r.name).slice(0, 120), categoryId: r.categoryId, date,
          createdAt: new Date().toISOString(),
        });
        return { tool: name, ok: true, summary: `Logged "${row.note}" ${fm(Number(row.amount))} on ${date}` };
      }
      case "spending_trend": {
        const months = Math.min(12, Math.max(2, Math.round(n(a.months) || 6)));
        const now = new Date();
        const keys: string[] = [];
        for (let i = months - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }
        const sums = new Map(keys.map((k) => [k, { income: 0, expense: 0 }]));
        for (const t of await listByUser("transactions", uid)) {
          const s = sums.get(String(t.date).slice(0, 7));
          if (!s) continue;
          if (t.type === "income") s.income += Number(t.amount);
          else s.expense += Number(t.amount);
        }
        const lines = keys.map((k) => {
          const s = sums.get(k)!;
          return `- ${k}: income ${fm(s.income)}, spent ${fm(s.expense)}, net ${fm(s.income - s.expense)}`;
        });
        return { tool: name, ok: true, summary: `Trend (last ${months} months):\n${lines.join("\n")}` };
      }
      case "create_category": {
        const kind = a.kind === "income" ? "income" : "expense";
        const cat = await findOrCreateCategory(uid, String(a.name), kind);
        return { tool: name, ok: true, summary: `Category ready: ${cat?.name}` };
      }
      case "update_category": {
        const all = await listByUser("categories", uid);
        const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
        const q = norm(a.name);
        const c = all.find((x) => norm(x.name) === q) || all.find((x) => norm(x.name).includes(q));
        if (!c) throw new Error("Category not found");
        const set: Record<string, unknown> = {};
        if (a.new_name !== undefined && String(a.new_name).trim()) set.name = String(a.new_name).trim().replace(/\s+/g, " ").slice(0, 32);
        if (a.kind === "income" || a.kind === "expense") set.kind = a.kind;
        if (!Object.keys(set).length) throw new Error("Nothing to update — provide new_name or kind");
        // Renaming onto an existing same-kind name merges instead of duplicating.
        if (set.name) {
          const finalKind = (set.kind as string) ?? c.kind;
          const clash = all.find((x) => x.id !== c.id && x.kind === finalKind && norm(x.name) === norm(set.name));
          if (clash) {
            const { mergeCategoryInto } = await import("@/lib/resources");
            await mergeCategoryInto(uid, c.id, clash.id);
            return { tool: name, ok: true, summary: `Merged "${c.name}" into "${clash.name}" (one tile now, entries kept)` };
          }
        }
        const [row] = await updateRows("categories", (x) => x.id === c.id, set as never);
        if (!row) throw new Error("Category not found");
        return { tool: name, ok: true, summary: `Updated category "${c.name}" → "${row.name}"` };
      }
      case "delete_category": {
        const all = await listByUser("categories", uid);
        const q = String(a.name ?? "").trim().toLowerCase();
        const c = all.find((x) => x.name.toLowerCase() === q) || all.find((x) => x.name.toLowerCase().includes(q));
        if (!c) throw new Error("Category not found");
        await updateRows("transactions", (t) => t.categoryId === c.id && t.userId === uid, { categoryId: null } as never);
        await updateRows("budgets", (b) => b.categoryId === c.id && b.userId === uid, { categoryId: null } as never);
        await updateRows("recurring", (r) => r.categoryId === c.id && r.userId === uid, { categoryId: null } as never);
        await deleteRows("categories", (x) => x.id === c.id && x.userId === uid);
        return { tool: name, ok: true, summary: `Deleted category "${c.name}" (its entries are now Uncategorized)` };
      }
      case "load_sample_data": {
        const { clearUserData, DEFAULT_INCOME_USD, seedSample } = await import("@/lib/seed");
        const { getCurrency } = await import("@/lib/currency");
        const persona = user.persona === "student" ? "student" : "adult";
        await clearUserData(uid);
        await deleteRows("categories", (c) => c.userId === uid);
        await seedSample(uid, persona, user.currency);
        if (Number(user.monthlyIncome) === 0) {
          await updateRows("users", (u) => u.id === uid, {
            monthlyIncome: String(Math.round(DEFAULT_INCOME_USD[persona] * getCurrency(user.currency).rate)),
          });
        }
        return { tool: name, ok: true, summary: "Loaded realistic sample data (transactions, budgets, goals, bills)" };
      }
      case "clear_data": {
        const { clearUserData } = await import("@/lib/seed");
        await clearUserData(uid);
        return { tool: name, ok: true, summary: "Cleared all transactions, budgets, goals and recurring bills (categories and profile kept)" };
      }
      case "search_transactions": {
        const q = String(a.query ?? "").trim().toLowerCase();
        const type = a.type === "income" ? "income" : a.type === "expense" ? "expense" : null;
        const lim = Math.min(30, Math.max(1, Math.round(n(a.limit) || 15)));
        const cats = await listByUser("categories", uid);
        const cname = (id: number | null) => cats.find((c) => c.id === id)?.name ?? "Other";
        const all = (await listByUser("transactions", uid)).sort((x, y) => String(y.date).localeCompare(String(x.date)) || y.id - x.id);
        const hits = all
          .filter((t) => (!type || t.type === type) && (!q || t.note.toLowerCase().includes(q) || cname(t.categoryId).toLowerCase().includes(q)))
          .slice(0, lim);
        if (!hits.length) return { tool: name, ok: true, summary: "No matching transactions." };
        const lines = hits.map((t) => `#${t.id} ${t.date} ${t.type} ${fm(Number(t.amount))} [${cname(t.categoryId)}] ${t.note}`);
        return { tool: name, ok: true, summary: `${hits.length} result(s):\n${lines.join("\n")}` };
      }
      case "spending_by_category": {
        const m = /^\d{4}-\d{2}$/.test(String(a.month)) ? String(a.month) : isoDate(new Date()).slice(0, 7);
        const cats = await listByUser("categories", uid);
        const cname = (id: number | null) => cats.find((c) => c.id === id)?.name ?? "Other";
        const map = new Map<string, number>();
        for (const t of await listByUser("transactions", uid)) {
          if (t.type !== "expense" || !t.date.startsWith(m)) continue;
          map.set(cname(t.categoryId), (map.get(cname(t.categoryId)) ?? 0) + Number(t.amount));
        }
        const rows = [...map.entries()].sort((x, y) => y[1] - x[1]);
        if (!rows.length) return { tool: name, ok: true, summary: `No spending in ${m}.` };
        const total = rows.reduce((x, r) => x + r[1], 0);
        return { tool: name, ok: true, summary: `Spending ${m} (total ${fm(total)}):\n${rows.map(([k, v]) => `- ${k}: ${fm(v)}`).join("\n")}` };
      }
      case "month_totals": {
        const m = /^\d{4}-\d{2}$/.test(String(a.month)) ? String(a.month) : isoDate(new Date()).slice(0, 7);
        let income = 0, expense = 0;
        for (const t of await listByUser("transactions", uid)) {
          if (!t.date.startsWith(m)) continue;
          if (t.type === "income") income += Number(t.amount);
          else expense += Number(t.amount);
        }
        return { tool: name, ok: true, summary: `${m}: income ${fm(income)}, spent ${fm(expense)}, net ${fm(income - expense)}` };
      }
      case "list_budgets": {
        const m = isoDate(new Date()).slice(0, 7);
        const cats = await listByUser("categories", uid);
        const txs = await listByUser("transactions", uid);
        const rows = await listByUser("budgets", uid);
        if (!rows.length) return { tool: name, ok: true, summary: "No budgets set." };
        const lines = rows.map((b) => {
          const cn = cats.find((c) => c.id === b.categoryId)?.name ?? "Other";
          const spent = txs.filter((t) => t.type === "expense" && t.categoryId === b.categoryId && t.date.startsWith(m)).reduce((x, t) => x + Number(t.amount), 0);
          return `- ${cn}: ${fm(spent)} of ${fm(Number(b.monthlyLimit))}`;
        });
        return { tool: name, ok: true, summary: `Budgets:\n${lines.join("\n")}` };
      }
      case "list_goals": {
        const rows = await listByUser("goals", uid);
        if (!rows.length) return { tool: name, ok: true, summary: "No goals yet." };
        return { tool: name, ok: true, summary: `Goals:\n${rows.map((g) => `- ${g.name}: ${fm(Number(g.saved))} of ${fm(Number(g.target))}${g.deadline ? ` by ${g.deadline}` : ""}`).join("\n")}` };
      }
      case "list_recurring": {
        const rows = await listByUser("recurring", uid);
        if (!rows.length) return { tool: name, ok: true, summary: "No recurring bills." };
        const total = rows.filter((r) => r.active).reduce((x, r) => x + Number(r.amount), 0);
        return { tool: name, ok: true, summary: `Recurring (${fm(total)}/mo active):\n${rows.map((r) => `- ${r.name}: ${fm(Number(r.amount))} on day ${r.dayOfMonth}${r.active ? "" : " (paused)"}`).join("\n")}` };
      }
      case "navigate_page": {
        const dest = String(a.destination ?? "");
        if (!ALLOWED_DESTINATIONS.includes(dest)) throw new Error(`Unknown destination. Allowed: ${ALLOWED_DESTINATIONS.join(", ")}`);
        const reason = typeof a.reason === "string" && a.reason.trim() ? ` — ${a.reason.trim().slice(0, 120)}` : "";
        return { tool: name, ok: true, summary: `Navigating to ${dest}${reason}`, navigate: dest };
      }
      case "update_profile": {
        const set: Record<string, unknown> = {};
        const notes: string[] = [];
        if (a.name !== undefined) {
          const nm = String(a.name).trim().slice(0, 60);
          if (!nm) throw new Error("Name is required");
          set.name = nm;
          notes.push(`name → ${nm}`);
        }
        if (a.monthly_income !== undefined) {
          const amt = n(a.monthly_income);
          if (!Number.isFinite(amt) || amt < 0) throw new Error("Invalid income");
          set.monthlyIncome = String(amt);
          notes.push(`income → ${fm(amt)}`);
        }
        if (a.currency !== undefined) {
          const code = String(a.currency).trim().toUpperCase();
          const { CURRENCIES } = await import("@/lib/currency");
          if (!CURRENCIES.some((c) => c.code === code)) throw new Error(`Unknown currency ${code}`);
          if (code !== user.currency) {
            // Mirror Settings → currency convert: rewrite every stored amount
            // into the new currency so the numbers stay real, not just relabeled.
            const { getCurrency } = await import("@/lib/currency");
            const next = getCurrency(code);
            const prev = getCurrency(user.currency);
            const ratio = next.rate / prev.rate;
            const d = next.decimals;
            const roundTo = (v: number) => Math.round(v * 10 ** d) / 10 ** d;
            // One read + one bulk write per table (per-row updateRows would
            // cost 2+ Firestore round-trips EACH and time out on big accounts).
            const txAll = await listByUser("transactions", uid);
            await replaceRows(
              "transactions",
              txAll.map((t) => ({ ...t, amount: String(roundTo(Number(t.amount) * ratio)) })),
            );
            const bAll = await listByUser("budgets", uid);
            await replaceRows(
              "budgets",
              bAll.map((b) => ({ ...b, monthlyLimit: String(roundTo(Number(b.monthlyLimit) * ratio)) })),
            );
            const gAll = await listByUser("goals", uid);
            await replaceRows(
              "goals",
              gAll.map((g) => ({
                ...g,
                target: String(roundTo(Number(g.target) * ratio)),
                saved: String(roundTo(Number(g.saved) * ratio)),
              })),
            );
            const rAll = await listByUser("recurring", uid);
            await replaceRows(
              "recurring",
              rAll.map((r) => ({ ...r, amount: String(roundTo(Number(r.amount) * ratio)) })),
            );
            set.currency = code;
            notes.push(`currency → ${code} (all amounts converted)`);
            if (set.monthlyIncome === undefined) {
              set.monthlyIncome = String(roundTo(Number(user.monthlyIncome) * ratio));
              notes.push(`income converted to ${code}`);
            }
          }
        }
        if (a.ai_personality !== undefined) {
          const { AI_PERSONALITIES } = await import("@/lib/personalities");
          const p = String(a.ai_personality).trim().toLowerCase();
          if (!(p in AI_PERSONALITIES)) throw new Error(`Unknown personality. Allowed: ${Object.keys(AI_PERSONALITIES).join(", ")}`);
          set.aiPersonality = p;
          notes.push(`coach → ${p}`);
        }
        if (!Object.keys(set).length) throw new Error("Nothing to update — provide name, monthly_income, currency, or ai_personality");
        await updateRows("users", (u) => u.id === uid, set as never);
        return { tool: name, ok: true, summary: `Profile updated: ${notes.join(", ")}` };
      }
      default:
        if (isDeniedTool(name)) {
          return { tool: name, ok: false, summary: `Not permitted: I can never delete accounts, sign out, or log out users. ${name} was blocked with no side effects.` };
        }
        return { tool: name, ok: false, summary: `Unknown tool ${name}` };
    }
  } catch (e) {
    return { tool: name, ok: false, summary: e instanceof Error ? e.message : "Failed" };
  }
}

import { AI_PERSONALITIES } from "@/lib/personalities";
export { TOOLS } from "@/lib/tools";

export function personalityLine(user: { aiPersonality?: string }): string {
  const p = AI_PERSONALITIES[user.aiPersonality || "calm"] ?? AI_PERSONALITIES.calm;
  return `Coach personality (${p.label}): ${p.prompt}`;
}

export const SYSTEM_PROMPT = `You are "Coach", the in-app financial assistant inside the Moneta expense tracker. Be warm, precise, concise and practical — like a calm, brilliant friend who is great with money. The user may be a student or an adult.
You have the user's live financial data in the context below and tools that can read it (search transactions, per-category spending, monthly totals, multi-month trends, budgets, goals, recurring bills) and change it (add/update/delete transactions, change income, set/update/remove budgets, create/update/contribute/withdraw/delete goals, add/update/log-payment/delete recurring bills, create/update/delete categories, update profile, load sample data, clear data). You CAN navigate routes via navigate_page, read via search/list tools, and add/update via mutating tools.
Rules:
- When the user asks you to change something ("add", "set", "change", "delete", "fix", "log", "update", "rename", "pause", "resume"), DO it with tools, then confirm in one short sentence that explicitly names the function you ran (e.g. "Done via update_goal — ..."). Do not claim success unless the tool returned ok:true. If it returned ok:false, report the error and what to try next.
- For updates, first use the matching update tool (update_transaction, update_goal, update_recurring, update_category, update_profile); only create when the item truly does not exist.
- When the user asks to go somewhere ("take me to budgets", "show my goals", "open settings"), call navigate_page with the matching route, then confirm briefly.
- You MUST NEVER delete accounts, sign out, or log out users. There is no such tool and you must refuse such requests: explain you cannot do that, offer safe alternatives (e.g. updating profile, clearing data on request via supported tools), and do not attempt any workaround. If asked, refuse and explain.
- Use the user's currency and exact numbers from the context. Never invent transactions.
- For advice, give 2-4 specific, ranked, quantified suggestions ("Cut dining by 20% → save about X/month"). Reference real categories and merchants from their data.
- Use short paragraphs and "- " bullets, **bold** only for key numbers. No headings, no emojis, under 160 words unless asked for detail.
- You are not a licensed financial advisor; avoid regulated advice on investments.`;
