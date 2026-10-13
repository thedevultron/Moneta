"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Field, Input, Segmented, Sheet } from "@/components/ui";
import { useApp } from "@/components/app/DataProvider";
import { Icon, inkOn } from "@/lib/icons";
import { HoldButton } from "@/components/micro";
import { getCurrency } from "@/lib/currency";
import { isoDate, todayISO } from "@/lib/stats";
import type { Tx } from "@/lib/types";

export function TxSheet() {
  const { txDraft, closeTx } = useApp();
  return (
    <Sheet open={!!txDraft} onClose={closeTx} title={txDraft?.id ? "Edit transaction" : "New transaction"} tall>
      {txDraft && <TxForm key={txDraft.id ?? "new"} draft={txDraft} />}
    </Sheet>
  );
}

function TxForm({ draft }: { draft: Partial<Tx> }) {
  const { data, currency, create, update, remove, closeTx, toast } = useApp();
  const editing = !!draft.id;
  const [type, setType] = useState<"expense" | "income">(draft.type ?? "expense");
  const [amount, setAmount] = useState(draft.amount ? String(draft.amount) : "");
  const [note, setNote] = useState(draft.note ?? "");
  const [date, setDate] = useState(draft.date ?? todayISO());
  const [categoryId, setCategoryId] = useState<number | null>(draft.categoryId ?? null);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const symbol = getCurrency(currency).symbol;

  useEffect(() => {
    const t = setTimeout(() => !editing && ref.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [editing]);

  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  // One tile per name: same-name dupes (if any survive) never render twice.
  const cats = (data?.categories ?? [])
    .filter((c) => c.kind === type)
    .filter((c, i, arr) => arr.findIndex((x) => norm(x.name) === norm(c.name)) === i);

  function save() {
    const n = Number(amount.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter an amount greater than zero");
      ref.current?.focus();
      return;
    }
    const body = { type, amount: n, note: note.trim(), date, categoryId };
    closeTx();
    if (editing && draft.id) {
      void update("transactions", draft.id, body).then((ok) => ok && toast("Transaction updated"));
    } else {
      void create("transactions", body).then((r) => r && toast(type === "income" ? "Income added" : "Expense added"));
    }
  }

  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return isoDate(d);
  })();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-5"
    >
      <Segmented
        value={type}
        onChange={(v) => {
          setType(v);
          setCategoryId(null);
        }}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
        ]}
      />
      <div className="flex items-baseline justify-center gap-2 py-2">
        <span className="font-display text-[34px] text-ash">{symbol}</span>
        <input
          ref={ref}
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value.replace(/[^0-9.,]/g, ""));
            setErr("");
          }}
          inputMode="decimal"
          placeholder="0"
          aria-label="Amount"
          className="font-display tabular w-full max-w-full bg-transparent text-center text-[52px] text-cloud outline-none placeholder:text-steel sm:max-w-[260px] sm:text-[64px]"
        />
      </div>
      {err && <p className="-mt-3 text-center text-[13px] text-[#ff8a8a]">{err}</p>}
      <Field label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "income" ? "e.g. Salary" : "e.g. Lunch with friends"} maxLength={120} />
      </Field>
      <div>
        <span className="label mb-2 block">Category</span>
        {cats.length === 0 ? (
          <p className="text-sm text-fog">No {type} categories yet — add some under More → Categories.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {cats.map((c) => {
              const on = categoryId === c.id;
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCategoryId(on ? null : c.id)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-center transition-all duration-200 active:scale-95"
                  style={on ? { background: c.color, color: inkOn(c.color), borderColor: c.color } : { borderColor: "rgba(255,255,255,0.08)", color: "#cacaca" }}
                >
                  <Icon name={c.icon} size={20} />
                  <span className="w-full truncate text-[11px]">{c.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <Field label="Date">
        <div className="flex gap-2">
          <Input type="date" value={date} max="2100-01-01" onChange={(e) => setDate(e.target.value)} className="flex-1" />
          <Button type="button" variant={date === todayISO() ? "primary" : "subtle"} size="md" onClick={() => setDate(todayISO())}>
            Today
          </Button>
          <Button type="button" variant={date === yesterday ? "primary" : "subtle"} size="md" onClick={() => setDate(yesterday)}>
            Yday
          </Button>
        </div>
      </Field>
      <div className="flex gap-3 pt-1">
        {editing && draft.id && (
          <HoldButton
            tone="danger"
            compact
            holdMs={900}
            full={false}
            aria-label="Hold to delete transaction"
            className="w-[52px] shrink-0"
            onHold={() => {
              closeTx();
              void remove("transactions", draft.id as number, { undo: true, label: "Transaction" });
            }}
          >
            <Trash2 size={17} />
          </HoldButton>
        )}
        <Button type="submit" full size="lg" arrow>
          {editing ? "Save changes" : "Add transaction"}
        </Button>
      </div>
    </form>
  );
}
