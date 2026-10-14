"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowDownRight, ArrowUpRight, CalendarClock, Plus, Receipt, Sparkles } from "lucide-react";
import { AnimatedNumber, Button, EmptyState, ProgressBar, Skeleton } from "@/components/ui";
import { useApp } from "@/components/app/DataProvider";
import { CumulativeChart, Ring } from "@/components/app/Charts";
import { CatBubble, TxRow } from "@/components/app/TxRow";
import { Icon, inkOn } from "@/lib/icons";
import {
  currentMonthKey, cumulativeSeries, daysInMonth, lastNDays, localTips, monthLabel, monthTotals, normName, parseISO, shiftMonth,
  spendByCategoryName, todayISO, type Tip,
} from "@/lib/stats";
import { maybeBillReminder } from "@/lib/notify";
import type { AppData } from "@/lib/types";

export default function HomePage() {
  const { data } = useApp();
  if (!data) return null;
  return <Home data={data} />;
}

function Home({ data }: { data: AppData }) {
  const { user, fmt, openTx, refresh, toast, catById } = useApp();
  const key = currentMonthKey();
  const prevKey = shiftMonth(key, -1);
  const today = new Date();
  const day = today.getDate();
  const first = user.name.split(" ")[0];
  const hour = today.getHours();
  const greet = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const transactions = data.transactions;
  const categories = data.categories;
  // Manual memo is the optimization here (no React Compiler in this project).
  const s = useMemo(() => {
    const t = monthTotals(transactions, key);
    const p = monthTotals(transactions, prevKey);
    const cur = cumulativeSeries(transactions, key, day);
    const prev = cumulativeSeries(transactions, prevKey, daysInMonth(prevKey));
    const prevSame = prev[Math.min(day, prev.length) - 1] ?? 0;
    const income = t.income > 0 ? t.income : user.monthlyIncome;
    const byCat = spendByCategoryName(transactions, categories, key);
    return { t, p, cur, prev, prevSame, income, byCat, week: lastNDays(transactions, 7) };
    // Manual memo is the optimization here (no React Compiler in this project).
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [transactions, categories, key, prevKey, day, user.monthlyIncome]);

  const delta = s.prevSame > 0 ? (s.t.expense - s.prevSame) / s.prevSame : 0;
  const left = s.income - s.t.expense;

  const [tips, setTips] = useState<Tip[]>(() => localTips(data));
  const [aiLoading, setAiLoading] = useState(true);
  const [aiMode, setAiMode] = useState<"gemini" | "local">("local");
  const [tipIdx, setTipIdx] = useState(0);

  // Mount-only session-cache read (hydration-safe).
  useEffect(() => {
    if (data.transactions.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAiLoading(false);
      return;
    }
    const cacheKey = `moneta_tips_${user.id}`;
    try {
      const c = JSON.parse(sessionStorage.getItem(cacheKey) ?? "null") as { at: number; tips: Tip[]; mode: "gemini" | "local" } | null;
      if (c && Date.now() - c.at < 10 * 60_000) {
        setTips(c.tips);
        setAiMode(c.mode);
        setAiLoading(false);
        return;
      }
    } catch {}
    let cancelled = false;
    fetch("/api/ai/insights", { method: "POST" })
      .then((r) => r.json())
      .then((j: { tips: Tip[]; mode: "gemini" | "local" }) => {
        if (cancelled || !j.tips?.length) return;
        setTips(j.tips);
        setAiMode(j.mode);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), ...j }));
        } catch {}
      })
      .catch(() => {})
      .finally(() => !cancelled && setAiLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    const t = setInterval(() => setTipIdx((i) => i + 1), 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    maybeBillReminder(user.id, data.recurring, (v) => fmt(v, { decimals: false }), daysInMonth, key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const tip = tips[tipIdx % Math.max(tips.length, 1)];
  const totalSaving = tips.reduce((a, t) => a + (t.saving ?? 0), 0);

  const bills = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return data.recurring
      .filter((r) => r.active)
      .map((r) => {
        let d = new Date(t.getFullYear(), t.getMonth(), Math.min(r.dayOfMonth, daysInMonth(key)));
        if (d < t) d = new Date(t.getFullYear(), t.getMonth() + 1, Math.min(r.dayOfMonth, 28));
        return { r, d, days: Math.round((d.getTime() - t.getTime()) / 86400000) };
      })
      .filter((b) => b.days <= 14)
      .sort((a, b) => a.days - b.days)
      .slice(0, 4);
  }, [data.recurring, key]);

  async function loadSample() {
    const res = await fetch("/api/sample", { method: "POST" });
    if (res.ok) {
      await refresh();
      toast("Sample data loaded");
    }
  }

  const maxWeek = Math.max(1, ...s.week.map((w) => w.total));

  return (
    <div>
      <header className="mb-7 flex items-start justify-between gap-4 pt-2">
        <div className="min-w-0">
          <div className="label mb-2">{today.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
          <h1 className="font-display break-words text-[40px] leading-[1.02] sm:text-[52px]">
            {greet}, <em>{first}</em>
          </h1>
        </div>
        <Link href="/app/more" aria-label="Profile" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-[15px] text-cloud transition-colors hover:bg-white/10 lg:hidden">
          {user.name.slice(0, 1).toUpperCase()}
        </Link>
      </header>

      {data.transactions.length === 0 ? (
        <EmptyState icon={<Receipt size={26} strokeWidth={1.4} />} title="A quiet slate" body="Add your first expense to see your month come alive — or explore with realistic sample data.">
          <Button arrow onClick={() => openTx()}>Add expense</Button>
          <Button variant="ghost" onClick={loadSample}>Load sample data</Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Hero */}
          <section className="card relative min-w-0 overflow-hidden p-6 lg:col-span-7">
            <div className="flex items-center justify-between">
              <span className="label">Spent in {monthLabel(key).split(" ")[0]}</span>
              {s.prevSame > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[11px] ${delta > 0 ? "border-[#ff7a7a]/30 text-[#ff9a9a]" : "border-sage/40 text-sage"}`}>
                  {delta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {Math.abs(Math.round(delta * 100))}% vs last month
                </span>
              )}
            </div>
            <div className="mt-3">
              <AnimatedNumber fromZero value={s.t.expense} format={(v) => fmt(v, { decimals: false })} className="font-display block min-w-0 break-words text-[52px] leading-none sm:text-[76px]" />
            </div>
            <div className="mt-6 -mx-1 min-w-0">
              <CumulativeChart current={s.cur} previous={s.prev} days={daysInMonth(key)} />
              <div className="mt-2 flex justify-between px-1">
                <span className="label text-[10px]">1</span>
                <span className="label flex items-center gap-3 text-[10px]">
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block h-px w-4 bg-pale-iris" /> This month</span>
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block h-px w-4 border-t border-dashed border-white/40" /> Last</span>
                </span>
                <span className="label text-[10px]">{daysInMonth(key)}</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t hairline pt-5">
              <Stat label="Income" value={fmt(s.income, { compact: true, decimals: false })} />
              <Stat label={left >= 0 ? "Left" : "Over by"} value={fmt(Math.abs(left), { compact: true, decimals: false })} warn={left < 0} />
              <Stat label="Daily avg" value={fmt(s.t.expense / day, { compact: true, decimals: false })} />
            </div>
          </section>

          {/* Coach */}
          <section className="relative flex min-w-0 flex-col overflow-hidden rounded-[30px] bg-iris p-7 text-white lg:col-span-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em]">
                <Sparkles size={12} /> Coach {aiMode === "gemini" ? "· AI" : ""}
              </span>
              {totalSaving > 0 && <span className="font-mono text-[11px] uppercase tracking-wider text-white/80">Up to {fmt(totalSaving, { decimals: false })}/mo</span>}
            </div>
            <div className="mt-6 min-h-[168px] flex-1">
              {aiLoading && aiMode === "local" && tipIdx === 0 && (
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Analysing your spending…
                </div>
              )}
              {tip ? (
                <div key={tip.title} className="animate-fade-up">
                  <h2 className="font-display text-[34px] leading-[1.02]">{tip.title}</h2>
                  <p className="mt-3 text-[15px] font-light leading-relaxed text-white/85">{tip.body}</p>
                  {tip.saving ? <div className="mt-4 inline-flex rounded-full bg-black/25 px-3 py-1 font-mono text-[11px] uppercase tracking-wider">Save ~{fmt(tip.saving, { decimals: false })} / mo</div> : null}
                </div>
              ) : (
                <Skeleton className="h-32 !bg-white/20" />
              )}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-1.5">
                {tips.map((_, i) => (
                  <button key={i} aria-label={`Tip ${i + 1}`} onClick={() => setTipIdx(i)} className={`h-1.5 rounded-full transition-all duration-300 ${i === tipIdx % tips.length ? "w-6 bg-white" : "w-1.5 bg-white/40"}`} />
                ))}
              </div>
              <Link href="/app/ai" className="inline-flex items-center gap-1.5 rounded-lg bg-black px-4 py-2.5 text-sm text-white transition-transform active:scale-95">
                Ask Coach <ArrowRight size={15} />
              </Link>
            </div>
          </section>

          {/* Category tiles */}
          <section className="lg:col-span-12">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-[30px]">Where it went</h2>
              <Link href="/app/reports" className="label hover:text-white">Report →</Link>
            </div>
            <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
              {s.byCat.slice(0, 8).map((e, i) => {
                const color = e.color;
                const ink = inkOn(color);
                const b = data.budgets.find((x) => normName(catById(x.categoryId)?.name) === normName(e.name));
                return (
                  <Link
                    key={e.name}
                    href={`/app/transactions?cat=${e.id ?? ""}`}
                    className="flex h-[168px] w-[156px] shrink-0 animate-fade-up flex-col justify-between rounded-[30px] p-5 transition-transform duration-300 hover:-translate-y-1 lg:w-auto"
                    style={{ background: color, color: ink, animationDelay: `${i * 60}ms` }}
                  >
                    <Icon name={e.icon} size={22} />
                    <div>
                      <div className="text-[13px] opacity-80">{e.name}</div>
                      <div className="font-display tabular text-[30px] leading-none">{fmt(e.total, { compact: true, decimals: false })}</div>
                      {b && (
                        <div className="mt-2.5 h-1 overflow-hidden rounded-full" style={{ background: ink + "30" }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (e.total / b.monthlyLimit) * 100)}%`, background: ink }} />
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Recent */}
          <section className="card p-5 lg:col-span-7">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="font-display text-[28px]">Recent</h2>
              <Link href="/app/transactions" className="label hover:text-white">See all →</Link>
            </div>
            <div>
              {data.transactions.slice(0, 6).map((t) => (
                <TxRow key={t.id} tx={t} sub={`${catById(t.categoryId)?.name ?? "Uncategorised"} · ${t.date === todayISO() ? "Today" : parseISO(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`} />
              ))}
            </div>
          </section>

          <div className="space-y-5 lg:col-span-5">
            <section className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-[28px]">Last 7 days</h2>
                <span className="label tabular">{fmt(s.week.reduce((a, w) => a + w.total, 0), { decimals: false })}</span>
              </div>
              <div className="relative flex h-28 items-end gap-2.5 pl-8">
                <span className="absolute left-0 top-0 font-mono text-[9px] text-fog">{fmt(maxWeek, { compact: true, decimals: false })}</span>
                <span className="absolute left-0 top-1/2 font-mono text-[9px] text-fog">{fmt(maxWeek / 2, { compact: true, decimals: false })}</span>
                <div aria-hidden className="pointer-events-none absolute inset-x-8 bottom-0 top-0">
                  <div className="absolute inset-x-0 top-0 border-t border-dashed border-white/15" />
                  <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/15" />
                  <div className="absolute inset-x-0 bottom-0 border-t border-white/25" />
                </div>
                {s.week.map((w, i) => (
                  <div key={w.date} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={`w-full rounded-md transition-all duration-700 ${i === 6 ? "bg-white" : "bg-white/20"}`}
                        style={{ height: `${Math.max(4, (w.total / maxWeek) * 100)}%` }}
                        title={fmt(w.total)}
                      />
                    </div>
                    <span className="label text-[10px]">{parseISO(w.date).toLocaleDateString("en-US", { weekday: "narrow" })}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-[28px]">Coming up</h2>
                <Link href="/app/recurring" className="label hover:text-white">Bills →</Link>
              </div>
              {bills.length === 0 ? (
                <p className="py-4 text-sm font-light text-ash">Nothing due in the next two weeks.</p>
              ) : (
                bills.map(({ r, days }) => {
                  const c = catById(r.categoryId);
                  return (
                    <div key={r.id} className="flex items-center gap-3.5 py-2.5">
                      <CatBubble icon={c?.icon ?? "wallet"} color={c?.color ?? "#9f9fa0"} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px]">{r.name}</div>
                        <div className="flex items-center gap-1.5 text-[13px] font-light text-ash"><CalendarClock size={12} /> {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}</div>
                      </div>
                      <div className="tabular text-[15px]">{fmt(r.amount)}</div>
                    </div>
                  );
                })
              )}
            </section>

            <section className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-[28px]">Goals</h2>
                <Link href="/app/goals" className="label hover:text-white">All →</Link>
              </div>
              {data.goals.length === 0 ? (
                <p className="text-sm font-light text-ash">No goals yet — set one and Coach will help you reach it.</p>
              ) : (
                <div className="space-y-4">
                  {data.goals.slice(0, 3).map((g) => (
                    <div key={g.id} className="flex items-center gap-4">
                      <Ring value={g.saved / g.target} size={48} stroke={4}>
                        <Icon name={g.icon} size={16} className="text-ash" />
                      </Ring>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between text-[15px]"><span className="truncate">{g.name}</span><span className="tabular text-ash">{Math.round((g.saved / g.target) * 100)}%</span></div>
                        <div className="mt-2"><ProgressBar value={g.saved / g.target} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
      {data.transactions.length > 0 && (
        <div className="mt-8 flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => openTx()}><Plus size={15} /> Quick add</Button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className="label text-[10px]">{label}</div>
      <div className={`tabular mt-1 text-[19px] ${warn ? "text-[#ff9a9a]" : "text-cloud"}`}>{value}</div>
    </div>
  );
}
