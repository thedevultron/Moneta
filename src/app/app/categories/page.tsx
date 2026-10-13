"use client";

import { useState } from "react";
import { Folders, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, Field, Input, PageHeader, Segmented, Sheet } from "@/components/ui";
import { useApp } from "@/components/app/DataProvider";
import { CatBubble } from "@/components/app/TxRow";
import { Shredder } from "@/components/micro";
import { CATEGORY_COLORS, ICON_KEYS, Icon } from "@/lib/icons";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
  const { data, create, update, remove, toast, confirm } = useApp();
  const [edit, setEdit] = useState<Partial<Category> | null>(null);
  const [shredId, setShredId] = useState<number | null>(null);
  const cats = data?.categories ?? [];
  const groups: ["expense" | "income", string][] = [["expense", "Spending"], ["income", "Income"]];

  function shredDelete(c: Category) {
    setShredId(c.id);
  }

  return (
    <div>
      <PageHeader eyebrow="Organise" title="Categories" right={<Button size="sm" variant="subtle" onClick={() => setEdit({ kind: "expense" })}><Plus size={15} /> New</Button>} />
      {cats.length === 0 ? (
        <EmptyState icon={<Folders size={26} strokeWidth={1.4} />} title="No categories" body="Create categories to organise your spending and income.">
          <Button arrow onClick={() => setEdit({ kind: "expense" })}>Add category</Button>
        </EmptyState>
      ) : (
        <div className="space-y-7">
          {groups.map(([kind, label]) => {
            const list = cats.filter((c) => c.kind === kind);
            if (!list.length) return null;
            return (
              <section key={kind}>
                <div className="label mb-2 px-1">{label}</div>
                <div className="card divide-y divide-white/[0.06] px-4">
                  {list.map((c) => {
                    const count = data?.transactions.filter((t) => t.categoryId === c.id).length ?? 0;
                    return (
                      <Shredder
                        key={c.id}
                        shredding={shredId === c.id}
                        onDone={() => {
                          setShredId(null);
                          confirm({ title: "Delete category?", body: "Transactions keep their data but become uncategorised. Its budget is removed.", confirmLabel: "Delete", danger: true, onConfirm: async () => { await remove("categories", c.id); } });
                        }}
                      >
                        <div className="flex w-full items-center gap-3.5 py-3">
                          <button onClick={() => setEdit(c)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left" aria-label={`Edit ${c.name}`}>
                            <CatBubble icon={c.icon} color={c.color} />
                            <span className="flex-1 truncate text-[15px]">{c.name}</span>
                            <span className="text-[13px] font-light text-fog">{count} {count === 1 ? "entry" : "entries"}</span>
                          </button>
                          <button onClick={() => shredDelete(c)} aria-label={`Delete ${c.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ff5d5d]/10 text-[#ff8a8a] transition-transform active:scale-90">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </Shredder>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit category" : "New category"} tall>
        {edit && (
          <CatForm
            key={edit.id ?? "new"}
            cat={edit}
            onSave={(v) => {
              const id = edit.id;
              setEdit(null);
              if (id) void update("categories", id, v).then((ok) => ok && toast("Category updated"));
              else void create("categories", v).then((r) => r && toast("Category created"));
            }}
            onDelete={edit.id ? () => {
              const id = edit.id as number;
              setEdit(null);
              confirm({ title: "Delete category?", body: "Transactions keep their data but become uncategorised. Its budget is removed.", confirmLabel: "Delete", danger: true, onConfirm: async () => { await remove("categories", id); } });
            } : undefined}
          />
        )}
      </Sheet>
    </div>
  );
}

function CatForm({ cat, onSave, onDelete }: { cat: Partial<Category>; onSave: (v: Omit<Category, "id">) => void; onDelete?: () => void }) {
  const [name, setName] = useState(cat.name ?? "");
  const [icon, setIcon] = useState(cat.icon ?? "wallet");
  const [color, setColor] = useState(cat.color ?? CATEGORY_COLORS[0]);
  const [kind, setKind] = useState<"expense" | "income">(cat.kind ?? "expense");
  const [err, setErr] = useState("");
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setErr("Name is required");
        onSave({ name: name.trim(), icon, color, kind });
      }}
    >
      <div className="flex justify-center py-1"><CatBubble icon={icon} color={color} size={72} /></div>
      {!cat.id && <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: "Spending" }, { value: "income", label: "Income" }]} />}
      <Field label="Name"><Input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} maxLength={32} placeholder="e.g. Pets" autoFocus={!cat.id} /></Field>
      <div>
        <span className="label mb-2 block">Colour</span>
        <div className="flex flex-wrap gap-2.5">
          {CATEGORY_COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setColor(c)} aria-label={c} className={`h-9 w-9 rounded-full transition-transform ${color === c ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#141516]" : ""}`} style={{ background: c }} />
          ))}
        </div>
      </div>
      <div>
        <span className="label mb-2 block">Icon</span>
        <div className="grid grid-cols-7 gap-2">
          {ICON_KEYS.map((k) => (
            <button type="button" key={k} onClick={() => setIcon(k)} aria-label={k} className={`grid h-11 place-items-center rounded-xl border transition-all ${icon === k ? "border-white bg-white text-black" : "border-white/10 text-ash hover:text-white"}`}>
              <Icon name={k} size={18} />
            </button>
          ))}
        </div>
      </div>
      {err && <p className="text-[13px] text-[#ff8a8a]">{err}</p>}
      <div className="flex gap-3">
        {onDelete && <Button type="button" variant="danger" onClick={onDelete} aria-label="Delete category"><Trash2 size={17} /></Button>}
        <Button type="submit" full size="lg" arrow>Save category</Button>
      </div>
    </form>
  );
}
