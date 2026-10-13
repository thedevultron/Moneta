import { formatMoney } from "@/lib/currency";
import type { AppData, Budget, Category, Tx } from "@/lib/types";

export const pad = (n: number) => String(n).padStart(2, "0");

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const todayISO = () => isoDate(new Date());
export const monthKeyOf = (date: string) => date.slice(0, 7);
export const currentMonthKey = () => monthKeyOf(todayISO());

export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function monthLabel(key: string, short = false) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
  });
}
export function daysInMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
export function parseISO(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function prettyDay(date: string) {
  const t = todayISO();
  if (date === t) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (date === isoDate(y)) return "Yesterday";
  return parseISO(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function monthTotals(txs: Tx[], key: string) {
  let expense = 0;
  let income = 0;
  for (const t of txs) {
    if (monthKeyOf(t.date) !== key) continue;
    if (t.type === "expense") expense += t.amount;
    else income += t.amount;
  }
  return { expense, income };
}

export function spendByCategory(txs: Tx[], key: string) {
  const m = new Map<number | null, number>();
  for (const t of txs) {
    if (t.type !== "expense" || monthKeyOf(t.date) !== key) continue;
    m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount);
  }
  return m;
}

/** Canonical form for comparing category names (case/whitespace-insensitive). */
export function normName(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export type CategorySpend = { id: number | null; name: string; color: string; icon: string; total: number };

/**
 * Same-month spend aggregated by category NAME, not id — so same-name
 * categories (e.g. two "Rent" rows) add up into ONE entry instead of
 * rendering repetitive tiles/slices.
 */
export function spendByCategoryName(txs: Tx[], cats: Category[], key: string): CategorySpend[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const agg = new Map<string, CategorySpend>();
  for (const t of txs) {
    if (t.type !== "expense" || monthKeyOf(t.date) !== key) continue;
    const c = t.categoryId == null ? undefined : byId.get(t.categoryId);
    const name = c?.name ?? "Other";
    const k = c ? `c::${normName(name)}` : "other";
    const hit = agg.get(k);
    if (hit) hit.total += t.amount;
    else agg.set(k, { id: c?.id ?? null, name, color: c?.color ?? "#6a6b6b", icon: c?.icon ?? "wallet", total: t.amount });
  }
  return [...agg.values()].sort((a, b) => b.total - a.total);
}

/** Cumulative daily spend for a month up to `uptoDay` */
export function cumulativeSeries(txs: Tx[], key: string, uptoDay: number) {
  const days = new Array(uptoDay).fill(0) as number[];
  for (const t of txs) {
    if (t.type !== "expense" || monthKeyOf(t.date) !== key) continue;
    const d = Number(t.date.slice(8, 10));
    if (d <= uptoDay) days[d - 1] += t.amount;
  }
  let acc = 0;
  return days.map((v) => (acc += v));
}

export function lastNDays(txs: Tx[], n: number) {
  const out: { date: string; total: number }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push({ date: isoDate(d), total: 0 });
  }
  const idx = new Map(out.map((o, i) => [o.date, i]));
  for (const t of txs) {
    if (t.type !== "expense") continue;
    const i = idx.get(t.date);
    if (i !== undefined) out[i].total += t.amount;
  }
  return out;
}

export function monthlyHistory(txs: Tx[], months: number) {
  const cur = currentMonthKey();
  const out: { key: string; expense: number; income: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = shiftMonth(cur, -i);
    out.push({ key, ...monthTotals(txs, key) });
  }
  return out;
}

export type Tip = { title: string; body: string; saving?: number };

/** Rule-based coaching tips (used when no AI key is configured, and as fast placeholders). */
export function localTips(data: AppData): Tip[] {
  const cur = data.user.currency;
  const fm = (v: number) => formatMoney(v, cur, { decimals: false });
  const key = currentMonthKey();
  const prev = shiftMonth(key, -1);
  const now = new Date();
  const day = now.getDate();
  const dim = daysInMonth(key);
  const catName = (id: number | null) => data.categories.find((c) => c.id === id)?.name ?? "Other";
  const { expense, income } = monthTotals(data.transactions, key);
  const tips: Tip[] = [];

  if (data.transactions.length === 0) {
    return [
      { title: "Log your first expense", body: "Tap + to add a purchase. Tracking for just 7 days reveals your spending pattern." },
      { title: "Set a monthly income", body: "Add your income in Settings so the coach can calculate your savings rate." },
      { title: "Create one budget", body: "Start with your biggest category — a simple limit is the fastest way to spend less." },
    ];
  }

  // over-budget categories (grouped by NAME so same-name categories add up)
  const spendRows = spendByCategoryName(data.transactions, data.categories, key);
  const prevRows = spendByCategoryName(data.transactions, data.categories, prev);
  const prevByName = new Map(prevRows.map((p) => [normName(p.name), p.total]));
  const budgetByName = new Map<string, { name: string; limit: number }>();
  for (const b of data.budgets) {
    const nm = catName(b.categoryId);
    const k = normName(nm);
    const hit = budgetByName.get(k);
    if (hit) hit.limit += b.monthlyLimit;
    else budgetByName.set(k, { name: nm, limit: b.monthlyLimit });
  }
  for (const s of spendRows) {
    const bl = budgetByName.get(normName(s.name));
    if (bl && s.total > bl.limit) {
      tips.push({
        title: `${s.name} is over budget`,
        body: `You've spent ${fm(s.total)} against a ${fm(bl.limit)} limit. Pause non-essentials here for the rest of the month.`,
        saving: Math.round((s.total - bl.limit) * 0.8),
      });
    }
  }
  // biggest increase vs last month
  let worst: { name: string; diff: number } | null = null;
  for (const s of spendRows) {
    const diff = s.total - (prevByName.get(normName(s.name)) ?? 0);
    if (diff > 0 && (!worst || diff > worst.diff)) worst = { name: s.name, diff };
  }
  if (worst && worst.diff > 0) {
    tips.push({
      title: `${worst.name} is trending up`,
      body: `${fm(worst.diff)} more than the same point last month. Try a 1-week cap and see how it feels.`,
      saving: Math.round(worst.diff * 0.5),
    });
  }
  // small frequent purchases
  const smallCut = (income || data.user.monthlyIncome || 1000) * 0.004;
  const small = data.transactions.filter((t) => t.type === "expense" && monthKeyOf(t.date) === key && t.amount <= smallCut);
  if (small.length >= 8) {
    const total = small.reduce((a, t) => a + t.amount, 0);
    tips.push({
      title: "Small buys add up",
      body: `${small.length} small purchases came to ${fm(total)} this month. Bundling or skipping a third of them is painless.`,
      saving: Math.round(total / 3),
    });
  }
  // subscriptions
  const subs = data.recurring.filter((r) => r.active).reduce((a, r) => a + r.amount, 0);
  if (data.recurring.length) {
    tips.push({
      title: "Audit recurring bills",
      body: `Your ${data.recurring.filter((r) => r.active).length} recurring items cost ${fm(subs)}/month. Cancel or downgrade one you rarely use.`,
      saving: Math.round(subs * 0.1),
    });
  }
  // pace
  const monthIncome = income || data.user.monthlyIncome;
  if (monthIncome > 0 && day >= 8) {
    const projected = (expense / Math.max(day, 1)) * dim;
    if (projected > monthIncome * 0.9) {
      tips.push({
        title: "You're on pace to overspend",
        body: `At this rate you'll spend about ${fm(projected)} this month vs ${fm(monthIncome)} income. Trim ${fm((projected - monthIncome * 0.8) / 2)} from flexible categories.`,
        saving: Math.round(Math.max(projected - monthIncome * 0.8, 0) / 2),
      });
    } else {
      tips.push({
        title: "Healthy pace — automate the surplus",
        body: `You're projected to keep ${fm(monthIncome - projected)} this month. Move it to a goal on payday so it never gets spent.`,
      });
    }
  }
  return tips.slice(0, 5);
}

export function buildContext(data: AppData): string {
  const cur = data.user.currency;
  const fm = (v: number) => formatMoney(v, cur);
  const key = currentMonthKey();
  const prev = shiftMonth(key, -1);
  const catName = (id: number | null) => data.categories.find((c) => c.id === id)?.name ?? "Uncategorised";
  const curSpend = spendByCategoryName(data.transactions, data.categories, key);
  const prevSpend = spendByCategoryName(data.transactions, data.categories, prev);
  const budgetByName = new Map<string, number>();
  for (const b of data.budgets) {
    const k = normName(catName(b.categoryId));
    budgetByName.set(k, (budgetByName.get(k) ?? 0) + b.monthlyLimit);
  }
  const t = monthTotals(data.transactions, key);
  const pt = monthTotals(data.transactions, prev);
  const lines: string[] = [];
  lines.push(`Today: ${todayISO()}. User: ${data.user.name} (${data.user.persona}). Currency: ${cur}. Declared monthly income: ${fm(data.user.monthlyIncome)}.`);
  lines.push(`This month (${key}): spent ${fm(t.expense)}, income ${fm(t.income)}. Last month: spent ${fm(pt.expense)}, income ${fm(pt.income)}.`);
  lines.push("Categories (id:name:kind): " + data.categories.map((c) => `${c.id}:${c.name}:${c.kind}`).join(", "));
  lines.push(
    "Spend by category this month vs last month vs budget: " +
      ([...curSpend.map((s) => normName(s.name)), ...prevSpend.map((s) => normName(s.name))]
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((k) => {
          const c = curSpend.find((s) => normName(s.name) === k);
          const p = prevSpend.find((s) => normName(s.name) === k);
          const bl = budgetByName.get(k);
          return `${c?.name ?? p?.name ?? k}: ${fm(c?.total ?? 0)} / ${fm(p?.total ?? 0)} / ${bl !== undefined ? fm(bl) : "no budget"}`;
        })
        .join("; ") || "none"),
  );
  lines.push("Budgets: " + (data.budgets.map((b: Budget) => `${catName(b.categoryId)}=${fm(b.monthlyLimit)}`).join(", ") || "none"));
  lines.push("Goals: " + (data.goals.map((g) => `#${g.id} ${g.name}: ${fm(g.saved)} of ${fm(g.target)}${g.deadline ? ` by ${g.deadline}` : ""}`).join("; ") || "none"));
  lines.push("Recurring: " + (data.recurring.map((r) => `#${r.id} ${r.name} ${fm(r.amount)} on day ${r.dayOfMonth}${r.active ? "" : " (paused)"}`).join("; ") || "none"));
  lines.push(
    "Latest transactions (id|date|type|amount|category|note): " +
      data.transactions
        .slice(0, 45)
        .map((x: Tx) => `${x.id}|${x.date}|${x.type}|${x.amount}|${catName(x.categoryId)}|${x.note}`)
        .join("\n"),
  );
  return lines.join("\n");
}

export type { Category };
