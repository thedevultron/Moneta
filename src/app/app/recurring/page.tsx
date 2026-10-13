"use client";

import { useState } from "react";
import { CalendarClock, Plus, Repeat, Trash2 } from "lucide-react";
import { Button, EmptyState, Field, Input, PageHeader, Select, Sheet, Toggle } from "@/components/ui";
import { useApp } from "@/components/app/DataProvider";
import { CatBubble } from "@/components/app/TxRow";
import { getCurrency } from "@/lib/currency";
import { daysInMonth, currentMonthKey, todayISO } from "@/lib/stats";
import type { Recurring } from "@/lib/types";

function nextDue(day: number) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  let d = new Date(t.getFullYear(), t.getMonth(), Math.min(day, daysInMonth(currentMonthKey())));
  if (d < t) d = new Date(t.getFullYear(), t.getMonth() + 1, Math.min(day, 28));
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export default function RecurringPage() {
  const { data, fmt, create, update, remove, toast, currency, catById } = useApp();
  const [edit, setEdit] = useState<Partial<Recurring> | null>(null);
  const items = data?.recurring ?? [];
  const monthly = items.filter((r) => r.active).reduce((a, r) => a + r.amount, 0);

  return (
    <div>
      <PageHeader eyebrow="Bills & subscriptions" title="Recurring" right={<Button size="sm" variant="subtle" onClick={() => setEdit({})}><Plus size={15} /> New</Button>} />
      {items.length === 0 ? (
        <EmptyState icon={<Repeat size={26} strokeWidth={1.4} />} title="No recurring bills" body="Add rent, subscriptions and phone plans to see your fixed monthly commitments.">
          <Button arrow onClick={() => setEdit({})}>Add a bill</Button>
        </EmptyState>
      ) : (
        <>
          <section className="card mb-5 p-6">
            <div className="label">Fixed monthly</div>
            <div className="font-display tabular mt-2 text-[44px] leading-none sm:text-[56px]">{fmt(monthly, { decimals: false })}</div>
            <p className="mt-2 text-[13px] font-light text-ash">{fmt(monthly * 12, { decimals: false })} a year across {items.filter((r) => r.active).length} active items.</p>
          </section>
          <div className="card divide-y divide-white/[0.06] px-4">
            {items.map((r) => {
              const c = catById(r.categoryId);
              const d = nextDue(r.dayOfMonth);
              return (
                <div key={r.id} className="flex items-center gap-3.5 py-3.5">
                  <button onClick={() => setEdit(r)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
                    <CatBubble icon={c?.icon ?? "wallet"} color={r.active ? (c?.color ?? "#9f9fa0") : "#6a6b6b"} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[15px] ${r.active ? "" : "text-fog"}`}>{r.name}</span>
                      <span className="flex items-center gap-1.5 text-[13px] font-light text-ash"><CalendarClock size={12} /> {r.active ? (d === 0 ? "Due today" : `Due in ${d}d · day ${r.dayOfMonth}`) : "Paused"}</span>
                    </span>
                    <span className={`tabular text-[15px] ${r.active ? "" : "text-fog"}`}>{fmt(r.amount)}</span>
                  </button>
                  <Toggle on={r.active} onChange={(v) => void update("recurring", r.id, { active: v })} label={`${r.name} active`} />
                </div>
              );
            })}
          </div>
        </>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit bill" : "New bill"} tall>
        {edit && (
          <RecForm
            key={edit.id ?? "new"}
            item={edit}
            symbol={getCurrency(currency).symbol}
            onSave={(v) => {
              const id = edit.id;
              setEdit(null);
              if (id) void update("recurring", id, v).then((ok) => ok && toast("Bill updated"));
              else void create("recurring", v).then((r) => r && toast("Bill added"));
            }}
            onPost={edit.id ? () => {
              const r = edit as Recurring;
              setEdit(null);
              void create("transactions", { type: "expense", amount: r.amount, note: r.name, date: todayISO(), categoryId: r.categoryId }).then((x) => x && toast(`Logged ${r.name} today`));
            } : undefined}
            onDelete={edit.id ? () => { const id = edit.id as number; setEdit(null); void remove("recurring", id, { undo: true, label: "Bill" }); } : undefined}
          />
        )}
      </Sheet>
    </div>
  );
}

function RecForm({ item, onSave, onDelete, onPost, symbol }: { item: Partial<Recurring>; onSave: (v: Omit<Recurring, "id">) => void; onDelete?: () => void; onPost?: () => void; symbol: string }) {
  const { data } = useApp();
  const [name, setName] = useState(item.name ?? "");
  const [amount, setAmount] = useState(item.amount ? String(item.amount) : "");
  const [day, setDay] = useState(String(item.dayOfMonth ?? 1));
  const [cid, setCid] = useState<number | null>(item.categoryId ?? null);
  const [err, setErr] = useState("");
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const a = Number(amount.replace(",", "."));
        const d = Number(day);
        if (!name.trim()) return setErr("Name is required");
        if (!Number.isFinite(a) || a <= 0) return setErr("Enter an amount");
        if (!Number.isInteger(d) || d < 1 || d > 31) return setErr("Day must be between 1 and 31");
        onSave({ name: name.trim(), amount: a, dayOfMonth: d, categoryId: cid, active: item.active ?? true });
      }}
    >
      <Field label="Name"><Input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="e.g. Netflix" maxLength={48} autoFocus={!item.id} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Amount (${symbol})`}><Input value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.,]/g, "")); setErr(""); }} inputMode="decimal" placeholder="0" /></Field>
        <Field label="Day of month"><Input value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" /></Field>
      </div>
      <Field label="Category">
        <Select value={cid ?? ""} onChange={(e) => setCid(e.target.value ? Number(e.target.value) : null)}>
          <option value="">None</option>
          {(data?.categories ?? []).filter((c) => c.kind === "expense").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      {err && <p className="text-[13px] text-[#ff8a8a]">{err}</p>}
      {onPost && <Button type="button" variant="subtle" full onClick={onPost}>Log this payment today</Button>}
      <div className="flex gap-3">
        {onDelete && <Button type="button" variant="danger" onClick={onDelete} aria-label="Delete bill"><Trash2 size={17} /></Button>}
        <Button type="submit" full size="lg" arrow>Save bill</Button>
      </div>
    </form>
  );
}
