"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app/DataProvider";
import { LivePanel } from "@/components/app/LivePanel";
import { useLiveCoach } from "@/components/app/useLiveCoach";
import { ListeningBars } from "@/components/micro";
import { cn } from "@/components/ui";

type PillState = "idle" | "listening" | "thinking" | "speaking";

/**
 * Optional useApp: returns null outside DataProvider (public pages).
 * The try/catch is intentional — useApp throws when there is no provider.
 */
function useOptionalApp(): ReturnType<typeof useApp> | null {
  try {
    return useApp();
  } catch {
    return null;
  }
}

/**
 * Sticky Live Mode button, visible on all /app pages.
 * - Collapsed: 56px circular button parked above/left of the Tx FAB so the
 *   two never overlap (FAB: bottom-[104px] right-5 mobile, bottom-8 right-8 desktop).
 * - Expanded: bottom-sheet on mobile, side panel on desktop, hosting the
 *   shared LivePanel (compact) driven by this dock's single live session.
 */
export function GlobalLiveDock() {
  const app = useOptionalApp();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [pinLocked, setPinLocked] = useState(false);

  const userId = app?.user.id ?? 0;
  const hasPin = app?.user.hasPin ?? false;
  const live = useLiveCoach({
    onDataChanged: () => {
      try {
        sessionStorage.removeItem(`moneta_tips_${userId}`);
      } catch {}
      void app?.refresh();
    },
  });

  useEffect(() => {
    if (!app || !hasPin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPinLocked(false);
      return;
    }
    const key = `moneta_pin_ok_${userId}`;
    const check = () => {
      try {
        setPinLocked(sessionStorage.getItem(key) !== "1");
      } catch {
        setPinLocked(false);
      }
    };
    check();
    window.addEventListener("focus", check);
    const t = setInterval(check, 1500);
    return () => {
      window.removeEventListener("focus", check);
      clearInterval(t);
    };
  }, [app, hasPin, userId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  // One live session at a time: the Coach page hosts its own session, so if
  // the user navigates there while the dock session is running, stop the dock
  // one instead of letting two models talk over each other.
  const liveStatus = live.status;
  // Route-change response (event-like, not derived state).
  useEffect(() => {
    if (path?.startsWith("/app/ai") && (liveStatus === "live" || liveStatus === "connecting")) {
      live.stop();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  if (!app) return <PublicLiveButton />;
  if (app.status !== "ready") return null;
  if (pinLocked) return null;
  // /app/ai already hosts its own LivePanel — a second dock session would fight for the mic.
  if (path?.startsWith("/app/ai")) return null;

  // Same mapping as LivePanel: idle / listening / thinking(connecting+processing) / speaking.
  const pill: PillState =
    live.status === "live"
      ? (live.speaking ? "speaking" : live.processing ? "thinking" : "listening")
      : live.status === "connecting"
        ? "thinking"
        : "idle";

  const label = open
    ? "Minimize live coach"
    : pill === "listening"
      ? "Live coach is listening — open panel"
      : pill === "speaking"
        ? "Live coach is speaking — open panel"
        : pill === "thinking"
          ? "Live coach is connecting — open panel"
          : "Talk to your live coach";

  const liveActive = pill === "listening" || pill === "speaking";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          title="Live coach"
          className={cn(
            "fixed bottom-[calc(11rem+env(safe-area-inset-bottom))] right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-white text-black shadow-[0_18px_20px_rgba(0,0,0,0.35)] transition-all duration-300 active:scale-90 lg:bottom-[max(2rem,env(safe-area-inset-bottom))] lg:right-[104px]",
            pill === "speaking" && "shadow-[0_0_28px_rgba(255,255,255,0.5)] ring-2 ring-white/70",
          )}
        >
          {pill === "listening" && (
            <span className="absolute inset-0 animate-ping rounded-full bg-white/30" style={{ animationDuration: "1.6s" }} />
          )}
          {liveActive && (
            <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#ff5d5d]">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#ff5d5d]/70" />
            </span>
          )}
          {pill === "idle" && <Mic size={22} strokeWidth={1.8} />}
          {pill === "listening" && (
            <span className="relative flex flex-col items-center gap-1">
              <ListeningBars dark />
              {live.micLevel > 0.02 && (
                <span className="h-[3px] w-8 overflow-hidden rounded-full bg-black/10">
                  <span
                    className="block h-full rounded-full bg-black transition-[width]"
                    style={{ width: `${Math.round(live.micLevel * 100)}%` }}
                  />
                </span>
              )}
            </span>
          )}
          {pill === "thinking" && (
            <span className="flex gap-1.5">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-2 w-2 rounded-full bg-black"
                  style={{ animation: "dots 1.1s infinite", animationDelay: `${d * 0.15}s` }}
                />
              ))}
            </span>
          )}
          {pill === "speaking" && <ListeningBars dark live />}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Live coach"
            className="absolute inset-x-4 bottom-[calc(11rem+env(safe-area-inset-bottom))] flex max-h-[70dvh] animate-sheet-up flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#141516] shadow-2xl lg:inset-x-auto lg:bottom-8 lg:right-8 lg:top-24 lg:w-[400px] lg:animate-pop"
          >
            <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
              <div className="min-w-0">
                <div className="label">Live coach</div>
                <p className="truncate text-[13px] font-light text-fog">Talk it through, hands-free</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href="/app/ai"
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-white/[0.07] px-3.5 py-2 text-[13px] text-cloud transition-colors hover:text-white"
                >
                  Full chat →
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Minimize live coach"
                  title="Minimize"
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.07] text-ash transition-colors hover:text-white"
                >
                  <Minus size={17} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
              {/* Single shared session: mic-blocked / insecure-context gate lives inside LivePanel. */}
              <LivePanel compact session={live} />
            </div>
          </section>
        </div>
      )}
    </>
  );
}

/** Provider-free fallback for public pages: deep-links into the full voice chat. */
export function PublicLiveButton() {
  return (
    <Link
      href="/app/ai"
      aria-label="Talk to your AI coach"
      title="Live coach"
      className="fixed bottom-[max(2rem,env(safe-area-inset-bottom))] right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-white text-black shadow-[0_18px_20px_rgba(0,0,0,0.35)] transition-transform duration-200 active:scale-90"
    >
      <Mic size={22} strokeWidth={1.8} />
    </Link>
  );
}
