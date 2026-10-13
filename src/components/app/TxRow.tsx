"use client";

import { Icon } from "@/lib/icons";
import { useApp } from "@/components/app/DataProvider";
import type { Tx } from "@/lib/types";

export function CatBubble({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: color + "26", color }}>
      <Icon name={icon} size={size * 0.42} />
    </span>
  );
}

export function TxRow({ tx, sub }: { tx: Tx; sub?: string }) {
  const { catById, fmt, openTx } = useApp();
  const cat = catById(tx.categoryId);
  return (
    <button
      onClick={() => openTx(tx)}
      className="flex w-full items-center gap-3.5 rounded-2xl px-1 py-2.5 text-left transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
    >
      <CatBubble icon={cat?.icon ?? "wallet"} color={cat?.color ?? "#9f9fa0"} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-cloud">{tx.note || cat?.name || "Untitled"}</span>
        <span className="block truncate text-[13px] font-light text-ash">{sub ?? cat?.name ?? "Uncategorised"}</span>
      </span>
      <span className={`tabular shrink-0 text-[15px] ${tx.type === "income" ? "text-sage" : "text-cloud"}`}>
        {tx.type === "income" ? "+" : "−"}
        {fmt(tx.amount)}
      </span>
    </button>
  );
}
