"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight, Folders, House, LayoutGrid, LogOut, PanelLeftClose, PanelLeftOpen, PieChart, Plus, Repeat, Settings, Sparkles, Target, TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button, Skeleton, cn } from "@/components/ui";
import { GradualBlur } from "@/components/GradualBlur";
import { Logo } from "@/components/app/Logo";
import { PinLock } from "@/components/app/PinLock";
import { useApp } from "@/components/app/DataProvider";
import { TxSheet } from "@/components/app/TxSheet";
import { GlobalLiveDock } from "@/components/app/GlobalLiveDock";

const TABS: { href: string; label: string; icon: LucideIcon; center?: boolean }[] = [
  { href: "/app/transactions", label: "Activity", icon: ArrowLeftRight },
  { href: "/app/budgets", label: "Budgets", icon: PieChart },
  { href: "/app", label: "Home", icon: House, center: true },
  { href: "/app/ai", label: "Coach", icon: Sparkles },
  { href: "/app/more", label: "More", icon: LayoutGrid },
];

const MORE: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/app/goals", label: "Goals", icon: Target },
  { href: "/app/recurring", label: "Recurring", icon: Repeat },
  { href: "/app/reports", label: "Reports", icon: TrendingUp },
  { href: "/app/categories", label: "Categories", icon: Folders },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

const MORE_PATHS = ["/app/more", ...MORE.map((m) => m.href)];

function isActive(path: string, href: string) {
  if (href === "/app") return path === "/app";
  if (href === "/app/more") return MORE_PATHS.includes(path) || MORE_PATHS.some((p) => path.startsWith(p + "/"));
  return path === href || path.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { status, user, openTx, refresh } = useApp();
  const showFab = !["/app/ai", "/app/more", "/app/settings", "/app/categories"].includes(path);
  const [collapsed, setCollapsed] = useState(false);

  // Mount-only storage read (hydration-safe: collapsed UI must match SSR first).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem("moneta_sidebar_collapsed") === "1");
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem("moneta_sidebar_collapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  return (
    <div className="min-h-dvh bg-obsidian">
      {/* Desktop sidebar (collapsible to an icon rail on PC) */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col border-r hairline bg-abyss py-6 transition-[width] duration-300 lg:flex", collapsed ? "w-[76px] items-center px-3" : "w-[260px] px-4")}>
        <div className={cn("mb-8 flex items-center", collapsed ? "flex-col gap-3 px-0" : "gap-2.5 px-3")}>
          <Link href="/" className="flex items-center gap-2.5" aria-label="Moneta home">
            <Logo />
            {!collapsed && <span className="font-display text-[26px]">Moneta</span>}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
            className="grid h-8 w-8 place-items-center rounded-lg text-fog transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <nav className={cn("space-y-1", collapsed && "w-full")}>
          {[TABS[2], TABS[0], TABS[1], TABS[3]].map((t) => (
            <SideLink key={t.href} {...t} active={isActive(path, t.href)} collapsed={collapsed} />
          ))}
        </nav>
        {!collapsed && <div className="label mb-2 mt-7 px-3">More</div>}
        {collapsed && <div className="my-4 h-px w-8 bg-white/10" aria-hidden />}
        <nav className={cn("space-y-1", collapsed && "w-full")}>
          {MORE.map((t) => (
            <SideLink key={t.href} {...t} active={isActive(path, t.href)} collapsed={collapsed} />
          ))}
        </nav>
        <div className={cn("mt-auto space-y-4", collapsed && "flex w-full flex-col items-center")}>
          {collapsed ? (
            <button
              onClick={() => openTx()}
              aria-label="Add transaction"
              title="Add transaction"
              className="grid h-11 w-11 place-items-center rounded-xl bg-white text-black transition-transform active:scale-90"
            >
              <Plus size={20} strokeWidth={1.8} />
            </button>
          ) : (
            <Button full arrow onClick={() => openTx()}>
              Add transaction
            </Button>
          )}
          <div className={cn("flex items-center gap-3 rounded-2xl border hairline p-3", collapsed && "border-transparent p-0")}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-sm font-medium text-black">{user.name.slice(0, 1).toUpperCase()}</span>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-cloud">{user.name}</div>
                  <div className="truncate text-xs text-fog">{user.isDemo ? "Demo account" : user.email}</div>
                </div>
                <button onClick={logout} aria-label="Sign out" className="text-ash hover:text-white">
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
          {!collapsed && <p className="label px-1 text-[10px] text-fog">Made by Amir Bagawan</p>}
        </div>
      </aside>

      <main className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[260px]")}>
        <div className="mx-auto w-full max-w-[1040px] px-5 pb-44 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:pb-16 lg:pt-10">
          {status === "loading" && <ShellSkeleton />}
          {status === "error" && (
            <div className="card mt-20 flex flex-col items-center p-10 text-center">
              <h2 className="font-display text-[32px]">Couldn&apos;t load your data</h2>
              <p className="mb-6 mt-2 text-ash">Check your connection and try again.</p>
              <Button onClick={() => void refresh()}>Retry</Button>
            </div>
          )}
          {status === "ready" && <PinLock><div key={path} className="animate-fade-up">{children}</div></PinLock>}
        </div>
      </main>

      {/* Mobile: gradual blur + floating dock */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-36 lg:hidden">
        <GradualBlur position="bottom" className="!absolute" />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/60 to-transparent" />
      </div>

      {showFab && status === "ready" && (
        <button
          onClick={() => openTx()}
          aria-label="Add transaction"
          className="fixed bottom-[104px] right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-white text-black shadow-[0_18px_20px_rgba(0,0,0,0.35)] transition-transform duration-200 active:scale-90 lg:bottom-8 lg:right-8"
        >
          <Plus size={24} strokeWidth={1.8} />
        </button>
      )}

      <nav
        aria-label="Primary"
        className="glass-dock fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex h-[72px] max-w-[440px] items-center justify-between rounded-[28px] px-2 lg:hidden"
      >
        {TABS.map((t) => {
          const active = isActive(path, t.href);
          const I = t.icon;
          if (t.center) {
            return (
              <Link key={t.href} href={t.href} aria-label="Home" className="relative -mt-7 flex w-[20%] flex-col items-center">
                <span
                  className={cn(
                    "grid h-[60px] w-[60px] place-items-center rounded-full border transition-all duration-300 active:scale-90",
                    active ? "border-white bg-white text-black" : "border-white/15 bg-[#26272a] text-cloud",
                  )}
                >
                  <I size={24} strokeWidth={1.6} />
                </span>
                <span className={cn("label mt-1 text-[9px]", active ? "!text-white" : "")}>Home</span>
              </Link>
            );
          }
          return (
            <Link key={t.href} href={t.href} className="flex w-[20%] flex-col items-center gap-1 py-2" aria-current={active ? "page" : undefined}>
              <I size={22} strokeWidth={1.5} className={cn("transition-colors duration-200", active ? "text-white" : "text-fog")} />
              <span className={cn("label text-[9px] transition-colors", active ? "!text-white" : "!text-fog")}>{t.label}</span>
            </Link>
          );
        })}
      </nav>
      <TxSheet />
      <GlobalLiveDock />
    </div>
  );
}

function SideLink({ href, label, icon: I, active, collapsed }: { href: string; label: string; icon: LucideIcon; active: boolean; collapsed?: boolean }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors duration-200",
        collapsed && "justify-center px-0",
        active ? "bg-white/10 text-white" : "text-ash hover:bg-white/[0.05] hover:text-white",
      )}
    >
      <I size={18} strokeWidth={1.5} />
      {!collapsed && label}
    </Link>
  );
}

function ShellSkeleton() {
  return (
    <div className="space-y-5 pt-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-64 w-full !rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-32 !rounded-3xl" />
        <Skeleton className="h-32 !rounded-3xl" />
      </div>
      <Skeleton className="h-20 w-full !rounded-2xl" />
      <Skeleton className="h-20 w-full !rounded-2xl" />
    </div>
  );
}
