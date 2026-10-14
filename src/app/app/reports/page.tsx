"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, TrendingUp } from "lucide-react";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { useApp } from "@/components/app/DataProvider";
import { Breakdown, GaugeChart, SideLegend, TrendChart } from "@/components/app/StatCharts";
import { RubberSegment, TapSparks } from "@/components/micro";
import { CatBubble, TxRow } from "@/components/app/TxRow";
import { currentMonthKey, monthKeyOf, monthLabel, monthlyHistory, monthTotals, shiftMonth, spendByCategoryName } from "@/lib/stats";

type TrendKind = "line" | "area" | "bar";

export default function ReportsPage() {
  const { data, fmt, catById, toast } = useApp();
  const [month, setMonth] = useState(currentMonthKey());
  const [trend, setTrend] = useState<TrendKind>("area");
  const txs = useMemo(() => data?.transactions ?? [], [data?.transactions]);
  const history = useMemo(() => monthlyHistory(txs, 6), [txs]);
  const cats = useMemo(() => spendByCategoryName(txs, data?.categories ?? [], month), [txs, data?.categories, month]);
  const totals = monthTotals(txs, month);
  const top = useMemo(() => txs.filter((t) => t.type === "expense" && monthKeyOf(t.date) === month).sort((a, b) => b.amount - a.amount).slice(0, 5), [txs, month]);
  const saveRate = totals.income > 0 ? (totals.income - totals.expense) / totals.income : null;
  const selIdx = Math.max(0, history.findIndex((h) => h.key === month));

  function exportCsv() {
    const rows = [["Date", "Type", "Category", "Note", "Amount"], ...txs.map((t) => [t.date, t.type, catById(t.categoryId)?.name ?? "", t.note, String(t.amount)])];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `moneta-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported CSV");
  }

  if (txs.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Insights" title="Reports" />
        <EmptyState icon={<TrendingUp size={26} strokeWidth={1.4} />} title="Nothing to report yet" body="Once you log a few transactions, trends and breakdowns appear here." />
      </div>
    );
  }

  const monthTx = txs.filter((t) => monthKeyOf(t.date) === month);
  const incTotal = monthTx.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);

  return (
    <div>
      <PageHeader eyebrow="Insights" title="Reports" right={<Button size="sm" variant="subtle" onClick={exportCsv}><Download size={15} /> CSV</Button>} />

      <section className="card mb-5 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[28px]">Six months</h2>
          <RubberSegment
            value={trend}
            onChange={setTrend}
            options={[{ value: "line", label: "Line" }, { value: "area", label: "Area" }, { value: "bar", label: "Bar" }]}
            className="w-[210px]"
          />
        </div>
        <TapSparks>
          <TrendChart
            kind={trend}
            expense={history.map((h) => h.expense)}
            income={history.map((h) => h.income)}
            labels={history.map((h) => monthLabel(h.key, true))}
            selected={selIdx}
            onSelect={(i) => setMonth(history[i].key)}
          />
        </TapSparks>
        <div className="mt-4">
          <SideLegend
            items={[
              { id: "spent", label: `Spent · ${monthLabel(history[selIdx].key)}`, value: fmt(history[selIdx].expense, { decimals: false }), color: "#fff0cc" },
              { id: "income", label: `Income · ${monthLabel(history[selIdx].key)}`, value: fmt(history[selIdx].income, { decimals: false }), color: "rgba(255,255,255,0.35)" },
            ]}
          />
        </div>
      </section>

      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07] text-ash transition-transform active:scale-90"><ChevronLeft size={18} /></button>
        <div className="font-display text-[26px]">{monthLabel(month)}</div>
        <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month === currentMonthKey()} aria-label="Next month" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07] text-ash transition-transform active:scale-90 disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display mb-4 text-[28px]">Where it went</h2>
          {cats.length === 0 ? (
            <p className="py-10 text-center text-ash">No spending in {monthLabel(month)}.</p>
          ) : (
            <Breakdown
              centerLabel="Spent"
              centerValue={fmt(totals.expense, { compact: true, decimals: false })}
              fmt={(v) => fmt(v, { decimals: false })}
              data={cats.map((e) => ({
                id: e.name,
                label: e.name,
                sub: `${Math.round((e.total / Math.max(totals.expense, 1)) * 100)}% of spending`,
                color: e.color,
                amount: e.total,
              }))}
            />
          )}
        </section>

        <div className="space-y-5">
          <section className="card p-6">
            <h2 className="font-display mb-2 text-[28px]">Savings rate</h2>
            {saveRate === null ? (
              <p className="py-6 text-center text-sm font-light text-ash">Add income to measure your savings rate.</p>
            ) : (
              <GaugeChart
                value={saveRate}
                display={`${Math.round(saveRate * 100)}%`}
                sub={saveRate >= 0.2 ? "Healthy — automate the surplus" : saveRate >= 0 ? "Tight — trim flexible spending" : "Overspent this month"}
              />
            )}
            <div className="mt-4">
              <SideLegend
                items={[
                  { id: "in", label: "Income", value: fmt(incTotal, { decimals: false }), color: "#8fb8a0" },
                  { id: "out", label: "Spent", value: fmt(totals.expense, { decimals: false }), color: "#fff0cc" },
                  { id: "net", label: "Net", value: fmt(incTotal - totals.expense, { decimals: false }), color: "rgba(255,255,255,0.35)" },
                ]}
              />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-display mb-2 px-1 text-[28px]">Biggest purchases</h2>
            {top.length === 0 ? <p className="py-8 text-center text-ash">Nothing here.</p> : top.map((t) => <TxRow key={t.id} tx={t} sub={`${catById(t.categoryId)?.name ?? "Other"} · ${t.date.slice(5)}`} />)}
          </section>
        </div>
      </div>
    </div>
  );
}
