"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Folders, LogOut, Repeat, Settings, Sparkles, Target, TrendingUp, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { useApp } from "@/components/app/DataProvider";
import { getCurrency } from "@/lib/currency";

const TILES: { href: string; label: string; sub: string; icon: LucideIcon; bg: string; ink: string; hideOnMobile?: boolean }[] = [
  { href: "/app/goals", label: "Goals", sub: "Save for what matters", icon: Target, bg: "#847dff", ink: "#fff" },
  { href: "/app/recurring", label: "Recurring", sub: "Bills & subscriptions", icon: Repeat, bg: "#dd90d8", ink: "#0f1011" },
  { href: "/app/reports", label: "Reports", sub: "Trends & export", icon: TrendingUp, bg: "#90b8f0", ink: "#0f1011" },
  // The bottom nav already has Coach on mobile — keep this tile for desktop only.
  { href: "/app/ai", label: "Coach", sub: "Talk live or type", icon: Sparkles, bg: "#d1c9ff", ink: "#0f1011", hideOnMobile: true },
  { href: "/app/categories", label: "Categories", sub: "Organise your spending", icon: Folders, bg: "#d1c9ff", ink: "#0f1011" },
];

export default function MorePage() {
  const { user, data } = useApp();
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }
  return (
    <div>
      <PageHeader eyebrow="Everything else" title="More" />
      <section className="card mb-5 flex items-center gap-4 p-5">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-xl text-black">{user.name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px]">{user.name}</div>
          <div className="truncate text-[13px] font-light text-ash">{user.isDemo ? "Demo account" : user.email}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ash">{user.persona}</span>
            <span className="rounded-full border border-white/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ash">{getCurrency(user.currency).code}</span>
            <span className="rounded-full border border-white/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ash">Coach · {user.aiPersonality}</span>
            {user.hasPin && <span className="rounded-full border border-white/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ash">PIN lock</span>}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {TILES.map((t, i) => (
          <Link key={t.href} href={t.href} style={{ background: t.bg, color: t.ink, animationDelay: `${i * 70}ms` }} className={`${t.hideOnMobile ? "hidden lg:flex" : "flex"} aspect-[1/1.05] animate-fade-up flex-col justify-between rounded-[30px] p-5 transition-transform duration-300 hover:-translate-y-1 active:scale-[0.98]`}>
            <div className="flex items-start justify-between">
              <t.icon size={24} strokeWidth={1.5} />
              <ArrowUpRight size={18} className="opacity-60" />
            </div>
            <div>
              <div className="font-display text-[30px] leading-none">{t.label}</div>
              <div className="mt-1.5 text-[13px] opacity-75">{t.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card mt-3 divide-y divide-white/[0.06]">
        <Link href="/app/settings" className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]">
          <Settings size={20} strokeWidth={1.5} className="text-ash" />
          <span className="flex-1 text-[16px]">Settings</span>
          <span className="text-[13px] text-fog">Currency, income, data</span>
        </Link>
        <button onClick={logout} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]">
          <LogOut size={20} strokeWidth={1.5} className="text-ash" />
          <span className="flex-1 text-[16px]">Sign out</span>
        </button>
      </div>

      <p className="label mt-10 text-center text-[10px] text-fog">
        {data?.transactions.length ?? 0} transactions · Made by Amir Bagawan
      </p>
    </div>
  );
}
