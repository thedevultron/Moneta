"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Receipt, Search, X } from "lucide-react";
import { Button, EmptyState, PageHeader, Segmented, cn } from "@/components/ui";
import { useApp } from "@/components/app/DataProvider";
import { TxRow } from "@/components/app/TxRow";
import { Icon } from "@/lib/icons";
import { currentMonthKey, monthKeyOf, monthLabel, monthTotals, prettyDay, shiftMonth } from "@/lib/stats";

export default function TransactionsPage() {
  const { data, fmt, openTx, catById } = useApp();
  const [month, setMonth] = useState(currentMonthKey());
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "expense" | "income">("all");
  const [cat, setCat] = useState<number | "none" | null>(null);

  // One-shot read of the deep-link query (?cat=...) on mount.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("cat");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (c !== null) setCat(c === "" ? "none" : Number(c));
  }, []);

  const txs = useMemo(() => data?.transactions ?? [], [data?.transactions]);
  const totals = useMemo(() => monthTotals(txs, month), [txs, month]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return txs.filter((t) => {
      if (monthKeyOf(t.date) !== month) return false;
      if (type !== "all" && t.type !== type) return false;
      if (cat === "none" ? t.categoryId !== null : cat !== null && t.categoryId !== cat) return false;
      if (needle) {
        const name = catById(t.categoryId)?.name ?? "";
        if (!t.note.toLowerCase().includes(needle) && !name.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [txs, month, q, type, cat, catById]);

  const groups = useMemo(() => {
    const m = new Map<string, typeof list>();
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [list]);

  const isCurrent = month === currentMonthKey();
  const filtered = q || type !== "all" || cat !== null;
  const activeCats = (data?.categories ?? []).filter((c) => txs.some((t) => t.categoryId === c.id && monthKeyOf(t.date) === month));

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Transactions"
        right={<Button size="sm" variant="subtle" onClick={() => openTx()} className="hidden sm:inline-flex"><Plus size={15} /> Add</Button>}
      />

      <div className="mb-5 flex items-center justify-between">
        <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07] text-ash hover:text-white"><ChevronLeft size={18} /></button>
        <div className="font-display text-[26px]">{monthLabel(month)}</div>
        <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrent} aria-label="Next month" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07] text-ash hover:text-white disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>

      <div className="card mb-5 grid grid-cols-3 divide-x divide-white/[0.06] py-4">
        {[
          ["Income", fmt(totals.income, { compact: true, decimals: false })],
          ["Spent", fmt(totals.expense, { compact: true, decimals: false })],
          ["Net", fmt(totals.income - totals.expense, { compact: true, decimals: false, sign: true })],
        ].map(([l, v]) => (
          <div key={l} className="px-4 text-center">
            <div className="label text-[10px]">{l}</div>
            <div className="tabular mt-1 text-[18px]">{v}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-fog" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search transactions"
            aria-label="Search transactions"
            className="h-12 w-full rounded-lg border border-white/10 bg-black pl-11 pr-10 text-[15px] outline-none placeholder:text-fog focus:border-white/40"
          />
          {q && <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-ash"><X size={16} /></button>}
        </div>
      </div>
      <Segmented value={type} onChange={setType} className="mb-3" options={[{ value: "all", label: "All" }, { value: "expense", label: "Expenses" }, { value: "income", label: "Income" }]} />
      {activeCats.length > 0 && (
        <div className="no-scrollbar -mx-5 mb-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          {activeCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(cat === c.id ? null : c.id)}
              className={cn("flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] transition-all", cat === c.id ? "border-white bg-white text-black" : "border-white/10 text-ash hover:text-white")}
            >
              <Icon name={c.icon} size={14} /> {c.name}
            </button>
          ))}
        </div>
      )}

      {txs.length === 0 ? (
        <EmptyState icon={<Receipt size={26} strokeWidth={1.4} />} title="No transactions yet" body="Every great budget starts with one logged coffee.">
          <Button arrow onClick={() => openTx()}>Add transaction</Button>
        </EmptyState>
      ) : groups.length === 0 ? (
        <EmptyState icon={<Search size={26} strokeWidth={1.4} />} title="Nothing found" body={filtered ? "No transactions match these filters." : `No activity in ${monthLabel(month)}.`}>
          {filtered && <Button variant="ghost" onClick={() => { setQ(""); setType("all"); setCat(null); }}>Clear filters</Button>}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, items]) => {
            const dayTotal = items.reduce((a, t) => a + (t.type === "expense" ? -t.amount : t.amount), 0);
            return (
              <section key={date}>
                <div className="mb-1 flex items-center justify-between px-1">
                  <span className="label">{prettyDay(date)}</span>
                  <span className="label tabular">{fmt(dayTotal, { decimals: false, sign: true })}</span>
                </div>
                <div className="card px-3 py-1.5">
                  {items.map((t) => <TxRow key={t.id} tx={t} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
