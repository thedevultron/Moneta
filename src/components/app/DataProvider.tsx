"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import type { AppData, Category, ResourceMap, ResourceName, Tx, User } from "@/lib/types";
import { Button, Sheet } from "@/components/ui";

const TEMP = 1_000_000_000;

type ToastAction = { label: string; run: () => void };
type ToastItem = { id: number; msg: string; kind: "ok" | "error"; action?: ToastAction };
type ConfirmOpts = { title: string; body: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void | Promise<void> };

type Ctx = {
  data: AppData | null;
  status: "loading" | "ready" | "error";
  user: User;
  currency: string;
  fmt: (v: number, o?: { compact?: boolean; decimals?: boolean; sign?: boolean }) => string;
  catById: (id: number | null) => Category | undefined;
  refresh: () => Promise<void>;
  create: <R extends ResourceName>(r: R, body: Omit<ResourceMap[R], "id">) => Promise<ResourceMap[R] | null>;
  update: <R extends ResourceName>(r: R, id: number, patch: Partial<Omit<ResourceMap[R], "id">>) => Promise<boolean>;
  remove: (r: ResourceName, id: number, opts?: { undo?: boolean; label?: string }) => Promise<boolean>;
  updateProfile: (patch: Partial<Pick<User, "name" | "currency" | "monthlyIncome" | "persona" | "aiPersonality" | "thinkingLevel" | "onboardingComplete">> & { convert?: boolean; pin?: string; clearPin?: boolean }) => Promise<boolean>;
  txDraft: (Partial<Tx> & { open: true }) | null;
  openTx: (draft?: Partial<Tx>) => void;
  closeTx: () => void;
  toast: (msg: string, kind?: "ok" | "error", action?: ToastAction) => void;
  confirm: (o: ConfirmOpts) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || "Something went wrong");
  return json as T;
}

type AnyItem = { id: number } & Record<string, unknown>;

function sortList(r: ResourceName, list: AnyItem[]): AnyItem[] {
  const l = [...list];
  if (r === "transactions") {
    l.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  } else if (r === "recurring") {
    l.sort((a, b) => Number(a.dayOfMonth) - Number(b.dayOfMonth) || a.id - b.id);
  } else l.sort((a, b) => a.id - b.id);
  return l;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<AppData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [txDraft, setTxDraft] = useState<Ctx["txDraft"]>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOpts | null>(null);
  const [busy, setBusy] = useState(false);
  const dataRef = useRef<AppData | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const toast = useCallback((msg: string, kind: "ok" | "error" = "ok", action?: ToastAction) => {
    const id = ++counter.current;
    setToasts((t) => [...t.slice(-2), { id, msg, kind, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6000 : 3200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("load failed");
      setData((await res.json()) as AppData);
      setStatus("ready");
    } catch {
      setStatus((s) => (s === "loading" ? "error" : s));
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutateList = useCallback((r: ResourceName, fn: (list: AnyItem[]) => AnyItem[]) => {
    setData((d) => (d ? ({ ...d, [r]: sortList(r, fn(d[r] as unknown as AnyItem[])) } as AppData) : d));
  }, []);

  const create: Ctx["create"] = useCallback(
    async (r, body) => {
      const tempId = TEMP + ++counter.current;
      mutateList(r, (l) => [{ ...(body as object), id: tempId } as AnyItem, ...l]);
      try {
        const res = await api<{ item: ResourceMap[typeof r] }>(`/api/r/${r}`, "POST", body);
        mutateList(r, (l) => l.map((x) => (x.id === tempId ? (res.item as unknown as AnyItem) : x)));
        return res.item;
      } catch (e) {
        mutateList(r, (l) => l.filter((x) => x.id !== tempId));
        toast(e instanceof Error ? e.message : "Couldn't save", "error");
        return null;
      }
    },
    [mutateList, toast],
  );

  const update: Ctx["update"] = useCallback(
    async (r, id, patch) => {
      const prev = (dataRef.current?.[r] as unknown as AnyItem[] | undefined)?.find((x) => x.id === id);
      mutateList(r, (l) => l.map((x) => (x.id === id ? { ...x, ...(patch as object) } : x)));
      if (id >= TEMP) return true;
      try {
        const res = await api<{ item: AnyItem }>(`/api/r/${r}/${id}`, "PATCH", patch);
        mutateList(r, (l) => l.map((x) => (x.id === id ? res.item : x)));
        return true;
      } catch (e) {
        if (prev) mutateList(r, (l) => l.map((x) => (x.id === id ? prev : x)));
        toast(e instanceof Error ? e.message : "Couldn't update", "error");
        return false;
      }
    },
    [mutateList, toast],
  );

  const remove: Ctx["remove"] = useCallback(
    async (r, id, opts) => {
      const snapshot = dataRef.current;
      const prev = (snapshot?.[r] as unknown as AnyItem[] | undefined)?.find((x) => x.id === id);
      mutateList(r, (l) => l.filter((x) => x.id !== id));
      if (r === "categories") {
        setData((d) =>
          d
            ? {
                ...d,
                transactions: d.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
                recurring: d.recurring.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
                budgets: d.budgets.filter((b) => b.categoryId !== id),
              }
            : d,
        );
      }
      if (id >= TEMP) return true;
      try {
        await api(`/api/r/${r}/${id}`, "DELETE");
        if (opts?.undo && prev) {
          toast(`${opts.label ?? "Item"} deleted`, "ok", {
            label: "Undo",
            run: () => {
              const { id: _drop, ...rest } = prev;
              void _drop;
              void create(r, rest as never);
            },
          });
        }
        return true;
      } catch (e) {
        if (prev) mutateList(r, (l) => [...l, prev]);
        toast(e instanceof Error ? e.message : "Couldn't delete", "error");
        return false;
      }
    },
    [mutateList, toast, create],
  );

  const updateProfile: Ctx["updateProfile"] = useCallback(
    async (patch) => {
      const prev = dataRef.current?.user;
      const { convert, ...rest } = patch;
      setData((d) => (d ? { ...d, user: { ...d.user, ...rest } } : d));
      try {
        await api("/api/profile", "PATCH", patch);
        if (convert) await refresh();
        return true;
      } catch (e) {
        if (prev) setData((d) => (d ? { ...d, user: prev } : d));
        toast(e instanceof Error ? e.message : "Couldn't save", "error");
        return false;
      }
    },
    [refresh, toast],
  );

  const currency = data?.user.currency ?? "USD";
  const fmt = useCallback((v: number, o?: { compact?: boolean; decimals?: boolean; sign?: boolean }) => formatMoney(v, currency, o), [currency]);
  const catById = useCallback((id: number | null) => (id == null ? undefined : data?.categories.find((c) => c.id === id)), [data?.categories]);

  const value = useMemo<Ctx>(
    () => ({
      data,
      status,
      user: data?.user ?? { id: 0, email: "", name: "", currency: "USD", monthlyIncome: 0, persona: "adult", isDemo: false, aiPersonality: "calm", thinkingLevel: "medium", hasPin: false, onboardingComplete: true },
      currency,
      fmt,
      catById,
      refresh,
      create,
      update,
      remove,
      updateProfile,
      txDraft,
      openTx: (d) => setTxDraft({ ...(d ?? {}), open: true }),
      closeTx: () => setTxDraft(null),
      toast,
      confirm: setConfirmOpts,
    }),
    [data, status, currency, fmt, catById, refresh, create, update, remove, updateProfile, txDraft, toast],
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex flex-col items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {toasts.map((t) => (
          <div key={t.id} className="glass-dock pointer-events-auto flex animate-pop items-center gap-3 rounded-full py-2 pl-3 pr-3 text-sm text-cloud">
            <span className={`grid h-6 w-6 place-items-center rounded-full ${t.kind === "ok" ? "bg-white text-black" : "bg-[#ff5d5d] text-black"}`}>
              {t.kind === "ok" ? <Check size={14} /> : <X size={14} />}
            </span>
            <span>{t.msg}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action?.run();
                  setToasts((x) => x.filter((y) => y.id !== t.id));
                }}
                className="rounded-full bg-white/10 px-3 py-1 text-[13px] hover:bg-white/20"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
      <Sheet open={!!confirmOpts} onClose={() => setConfirmOpts(null)} title={confirmOpts?.title}>
        <p className="mb-6 text-[15px] font-light text-ash">{confirmOpts?.body}</p>
        <div className="flex gap-3">
          <Button variant="subtle" full onClick={() => setConfirmOpts(null)}>
            Cancel
          </Button>
          <Button
            full
            variant={confirmOpts?.danger ? "danger" : "primary"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await confirmOpts?.onConfirm();
              setBusy(false);
              setConfirmOpts(null);
            }}
          >
            {confirmOpts?.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </Sheet>
    </AppCtx.Provider>
  );
}
