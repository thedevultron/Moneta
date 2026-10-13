"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PieChart, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button, EmptyState, Field, Input, PageHeader, ProgressBar, Select, Sheet } from "@/components/ui";
import { useApp } from "@/components/app/DataProvider";
import { Ring } from "@/components/app/Charts";
import { CatBubble } from "@/components/app/TxRow";
import { currentMonthKey, daysInMonth, monthLabel, normName, spendByCategoryName } from "@/lib/stats";
import { getCurrency } from "@/lib/currency";

export default function BudgetsPage() {
  const { data, fmt, create, update, remove, toast, currency } = useApp();
  const [sheet, setSheet] = useState<{ categoryId: number | null; budgetId?: number } | null>(null);
  const key = currentMonthKey();
  const day = new Date().getDate();
  const dim = daysInMonth(key);

  const spendRows = useMemo(() => spendByCategoryName(data?.transactions ?? [], data?.categories ?? [], key), [data?.transactions, data?.categories, key]);
  const budgets = data?.budgets ?? [];
  const catNameOf = (id: number | null) => data?.categories.find((c) => c.id === id)?.name ?? "Other";
  // Spend looked up by NAME so same-name categories add up instead of repeating.
  const spendForCategory = (id: number | null) => spendRows.find((e) => normName(e.name) === normName(catNameOf(id)))?.total ?? 0;
  const totalBudget = budgets.reduce((a, b) => a + b.monthlyLimit, 0);
  const totalSpent = budgets.reduce((a, b) => a + spendForCategory(b.categoryId), 0);
  const left = totalBudget - totalSpent;
  const daysLeft = dim - day + 1;
  const budgetedNames = new Set(budgets.map((b) => normName(catNameOf(b.categoryId))));
  const unbudgeted = spendRows.filter((e) => e.id !== null && !budgetedNames.has(normName(e.name)));

  return (
    <div>
      <PageHeader eyebrow={monthLabel(key)} title="Budgets" right={<Button size="sm" variant="subtle" onClick={() => setSheet({ categoryId: null })}><Plus size={15} /> New</Button>} />

      {budgets.length === 0 ? (
        <EmptyState icon={<PieChart size={26} strokeWidth={1.4} />} title="No budgets yet" body="Set a monthly limit for the categories that matter. Coach can suggest realistic ones from your history.">
          <Button arrow onClick={() => setSheet({ categoryId: null })}>Create budget</Button>
          <Link href={`/app/ai?prompt=${encodeURIComponent("Look at my spending history and create sensible monthly budgets for my main categories.")}`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 px-[18px] text-[15px] hover:bg-white/10">
            <Sparkles size={15} /> Let Coach do it
          </Link>
        </EmptyState>
      ) : (
        <>
          <section className="card mb-5 flex items-center gap-6 p-6">
            <Ring value={totalBudget ? totalSpent / totalBudget : 0} size={112} stroke={8} color={left < 0 ? "#ff7a7a" : "#fff"}>
              <div className="text-center">
                <div className="font-display tabular text-[26px] leading-none">{totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0}%</div>
                <div className="label mt-1 text-[9px]">used</div>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <div className="label">{left >= 0 ? "Left to spend" : "Over budget by"}</div>
              <div className={`font-display tabular text-[44px] leading-none ${left < 0 ? "text-[#ff9a9a]" : ""}`}>{fmt(Math.abs(left), { decimals: false })}</div>
              <p className="mt-2 text-[13px] font-light text-ash">
                {left > 0 ? `About ${fmt(left / daysLeft, { decimals: false })} a day for ${daysLeft} more days.` : "Pause flexible spending to get back on track."}
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {budgets.map((b) => {
              const c = data?.categories.find((x) => x.id === b.categoryId);
              const s = spendForCategory(b.categoryId);
              const ratio = s / b.monthlyLimit;
              const over = ratio > 1;
              return (
                <button key={b.id} onClick={() => setSheet({ categoryId: b.categoryId, budgetId: b.id })} className="card animate-fade-up p-5 text-left transition-colors hover:bg-card2">
                  <div className="flex items-center gap-3.5">
                    <CatBubble icon={c?.icon ?? "wallet"} color={c?.color ?? "#9f9fa0"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[16px]">{c?.name ?? "Category"}</div>
                      <div className="text-[13px] font-light text-ash">{fmt(s, { decimals: false })} of {fmt(b.monthlyLimit, { decimals: false })}</div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${over ? "border-[#ff7a7a]/40 text-[#ff9a9a]" : ratio > 0.8 ? "border-copper/50 text-copper" : "border-white/15 text-ash"}`}>
                      {over ? "Over" : ratio > 0.8 ? "Close" : `${Math.round(ratio * 100)}%`}
                    </span>
                  </div>
                  <div className="mt-4"><ProgressBar value={ratio} color={c?.color} over={over} /></div>
                  <div className="mt-2 text-[12px] font-light text-fog">{over ? `${fmt(s - b.monthlyLimit, { decimals: false })} over` : `${fmt(b.monthlyLimit - s, { decimals: false })} left`}</div>
                </button>
              );
            })}
          </div>

          {unbudgeted.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display mb-3 text-[28px]">Not budgeted</h2>
              <div className="card divide-y divide-white/[0.06] px-4">
                {unbudgeted.map((e) => {
                  return (
                    <div key={e.name} className="flex items-center gap-3.5 py-3">
                      <CatBubble icon={e.icon} color={e.color} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px]">{e.name}</div>
                        <div className="text-[13px] font-light text-ash">{fmt(e.total, { decimals: false })} this month</div>
                      </div>
                      {e.id !== null && <Button size="sm" variant="subtle" onClick={() => setSheet({ categoryId: e.id })}>Set limit</Button>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet?.budgetId ? "Edit budget" : "New budget"}>
        {sheet && (
          <BudgetForm
            key={`${sheet.categoryId}-${sheet.budgetId}`}
            sheet={sheet}
            onSave={async (categoryId, limit) => {
              setSheet(null);
              if (sheet.budgetId) await update("budgets", sheet.budgetId, { monthlyLimit: limit });
              else await create("budgets", { categoryId, monthlyLimit: limit });
              toast("Budget saved");
            }}
            onDelete={
              sheet.budgetId
                ? () => {
                    const id = sheet.budgetId as number;
                    setSheet(null);
                    void remove("budgets", id, { undo: true, label: "Budget" });
                  }
                : undefined
            }
            symbol={getCurrency(currency).symbol}
          />
        )}
      </Sheet>
    </div>
  );
}

function BudgetForm({ sheet, onSave, onDelete, symbol }: { sheet: { categoryId: number | null; budgetId?: number }; onSave: (categoryId: number, limit: number) => void; onDelete?: () => void; symbol: string }) {
  const { data } = useApp();
  const existing = data?.budgets.find((b) => b.id === sheet.budgetId);
  const available = (data?.categories ?? []).filter((c) => c.kind === "expense" && (c.id === sheet.categoryId || !data?.budgets.some((b) => b.categoryId === c.id)));
  const [cid, setCid] = useState<number | null>(sheet.categoryId ?? available[0]?.id ?? null);
  const [limit, setLimit] = useState(existing ? String(existing.monthlyLimit) : "");
  const [err, setErr] = useState("");
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(limit.replace(",", "."));
        if (cid === null) return setErr("Pick a category");
        if (!Number.isFinite(n) || n <= 0) return setErr("Enter a limit greater than zero");
        onSave(cid, n);
      }}
    >
      <Field label="Category">
        <Select value={cid ?? ""} onChange={(e) => setCid(Number(e.target.value))} disabled={!!sheet.budgetId}>
          {available.length === 0 && <option value="">All categories have budgets</option>}
          {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label={`Monthly limit (${symbol})`}>
        <Input value={limit} onChange={(e) => { setLimit(e.target.value.replace(/[^0-9.,]/g, "")); setErr(""); }} inputMode="decimal" placeholder="0" autoFocus />
      </Field>
      {err && <p className="text-[13px] text-[#ff8a8a]">{err}</p>}
      <div className="flex gap-3">
        {onDelete && <Button type="button" variant="danger" onClick={onDelete} aria-label="Delete budget"><Trash2 size={17} /></Button>}
        <Button type="submit" full size="lg" arrow>Save budget</Button>
      </div>
    </form>
  );
}
