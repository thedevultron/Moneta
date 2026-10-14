"use client";

import { useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { Button, EmptyState, Field, Input, PageHeader, Sheet } from "@/components/ui";
import { useApp } from "@/components/app/DataProvider";
import { Ring } from "@/components/app/Charts";
import { Icon } from "@/lib/icons";
import { GOAL_ICON_KEYS } from "@/lib/icons";
import { getCurrency } from "@/lib/currency";
import { parseISO, todayISO } from "@/lib/stats";
import type { Goal } from "@/lib/types";

const GOAL_ICONS = GOAL_ICON_KEYS;

export default function GoalsPage() {
  const { data, fmt, create, update, remove, toast, currency } = useApp();
  const [edit, setEdit] = useState<Partial<Goal> | null>(null);
  const [fund, setFund] = useState<Goal | null>(null);
  const goals = data?.goals ?? [];
  const symbol = getCurrency(currency).symbol;

  const monthsLeft = (g: Goal) => {
    if (!g.deadline) return null;
    const d = parseISO(g.deadline);
    const now = parseISO(todayISO());
    return Math.max(1, (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth());
  };

  return (
    <div>
      <PageHeader eyebrow="Savings" title="Goals" right={<Button size="sm" variant="subtle" onClick={() => setEdit({})}><Plus size={15} /> New</Button>} />
      {goals.length === 0 ? (
        <EmptyState icon={<Target size={26} strokeWidth={1.4} />} title="Dream a little" body="A trip, a laptop, a safety net. Name it, size it, and watch it fill.">
          <Button arrow onClick={() => setEdit({})}>Create a goal</Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {goals.map((g, i) => {
            const pct = g.saved / g.target;
            const m = monthsLeft(g);
            const need = m ? Math.max(g.target - g.saved, 0) / m : null;
            return (
              <div key={g.id} className="card min-w-0 animate-fade-up p-5" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-start gap-3 sm:gap-4">
                  <Ring value={pct} size={64} stroke={5}>
                    <Icon name={g.icon} size={20} className="text-cloud" />
                  </Ring>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => setEdit(g)} className="block max-w-full truncate text-left font-display text-[24px] hover:opacity-80 sm:text-[28px]">{g.name}</button>
                    <div className="tabular text-[14px] font-light text-ash">{fmt(g.saved, { decimals: false })} of {fmt(g.target, { decimals: false })}</div>
                    {g.deadline && <div className="label mt-1.5 text-[10px]">By {parseISO(g.deadline).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>}
                  </div>
                  <div className="font-display tabular text-[22px] sm:text-[26px]">{Math.round(pct * 100)}%</div>
                </div>
                {need !== null && pct < 1 && <p className="mt-4 text-[13px] font-light text-ash">Save <span className="text-cloud">{fmt(need, { decimals: false })}</span> a month to get there.</p>}
                {pct >= 1 && <p className="mt-4 text-[13px] text-sage">Goal reached — well done.</p>}
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="primary" onClick={() => setFund(g)}>Add funds</Button>
                  <Button size="sm" variant="subtle" onClick={() => setEdit(g)}>Edit</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit goal" : "New goal"} tall>
        {edit && (
          <GoalForm
            key={edit.id ?? "new"}
            goal={edit}
            symbol={symbol}
            onSave={(v) => {
              const id = edit.id;
              setEdit(null);
              if (id) void update("goals", id, v).then((ok) => ok && toast("Goal updated"));
              else void create("goals", v).then((r) => r && toast("Goal created"));
            }}
            onDelete={edit.id ? () => { const id = edit.id as number; setEdit(null); void remove("goals", id, { undo: true, label: "Goal" }); } : undefined}
          />
        )}
      </Sheet>

      <Sheet open={!!fund} onClose={() => setFund(null)} title={fund ? `Add to ${fund.name}` : ""}>
        {fund && (
          <FundForm
            goal={fund}
            symbol={symbol}
            onSave={(amt) => {
              const g = fund;
              setFund(null);
              void update("goals", g.id, { saved: g.saved + amt }).then((ok) => ok && toast(`Added ${fmt(amt, { decimals: false })}`));
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function GoalForm({ goal, onSave, onDelete, symbol }: { goal: Partial<Goal>; onSave: (v: Omit<Goal, "id">) => void; onDelete?: () => void; symbol: string }) {
  const [name, setName] = useState(goal.name ?? "");
  const [icon, setIcon] = useState(goal.icon ?? "piggy-bank");
  const [target, setTarget] = useState(goal.target ? String(goal.target) : "");
  const [saved, setSaved] = useState(goal.saved ? String(goal.saved) : "");
  const [deadline, setDeadline] = useState(goal.deadline ?? "");
  const [err, setErr] = useState("");
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const t = Number(target.replace(",", "."));
        const s = Number((saved || "0").replace(",", "."));
        if (!name.trim()) return setErr("Give your goal a name");
        if (!Number.isFinite(t) || t <= 0) return setErr("Enter a target amount");
        if (!Number.isFinite(s) || s < 0) return setErr("Saved amount is invalid");
        onSave({ name: name.trim(), icon, target: t, saved: s, deadline: deadline || null });
      }}
    >
      <Field label="Name"><Input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="e.g. Lisbon trip" maxLength={48} autoFocus={!goal.id} /></Field>
      <div>
        <span className="label mb-2 block">Icon</span>
        <div className="grid grid-cols-5 gap-2">
          {GOAL_ICONS.map((k) => (
            <button type="button" key={k} onClick={() => setIcon(k)} className={`grid h-12 place-items-center rounded-xl border transition-all ${icon === k ? "border-white bg-white text-black" : "border-white/10 text-ash hover:text-white"}`} aria-label={k}>
              <Icon name={k} size={19} />
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Target (${symbol})`}><Input value={target} onChange={(e) => { setTarget(e.target.value.replace(/[^0-9.,]/g, "")); setErr(""); }} inputMode="decimal" placeholder="0" /></Field>
        <Field label={`Saved (${symbol})`}><Input value={saved} onChange={(e) => setSaved(e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="0" /></Field>
      </div>
      <Field label="Target date (optional)"><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
      {err && <p className="text-[13px] text-[#ff8a8a]">{err}</p>}
      <div className="flex gap-3">
        {onDelete && <Button type="button" variant="danger" onClick={onDelete} aria-label="Delete goal"><Trash2 size={17} /></Button>}
        <Button type="submit" full size="lg" arrow>Save goal</Button>
      </div>
    </form>
  );
}

function FundForm({ goal, onSave, symbol }: { goal: Goal; onSave: (n: number) => void; symbol: string }) {
  const [v, setV] = useState("");
  const remaining = Math.max(goal.target - goal.saved, 0);
  const quick = [0.05, 0.1, 0.25].map((f) => Math.max(1, Math.round((goal.target * f) / 5) * 5));
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(v.replace(",", "."));
        if (Number.isFinite(n) && n > 0) onSave(n);
      }}
    >
      <Field label={`Amount (${symbol})`} hint={`${remaining.toLocaleString()} left to reach your target`}>
        <Input value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="0" autoFocus />
      </Field>
      <div className="flex gap-2">
        {quick.map((q) => <Button key={q} type="button" size="sm" variant="subtle" onClick={() => setV(String(q))}>{symbol}{q.toLocaleString()}</Button>)}
      </div>
      <Button type="submit" full size="lg" arrow disabled={!(Number(v.replace(",", ".")) > 0)}>Add funds</Button>
    </form>
  );
}
