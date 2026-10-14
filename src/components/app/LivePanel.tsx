"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MicOff } from "lucide-react";
import { useApp } from "@/components/app/DataProvider";
import { ListeningBars, VoicePill } from "@/components/micro";
import { useLiveCoach } from "@/components/app/useLiveCoach";
import { cn } from "@/components/ui";

/** True Live voice panel (Gemini Live API): native audio + live transcripts + tools. */
export function LivePanel({ compact, session }: { compact?: boolean; session?: ReturnType<typeof useLiveCoach> }) {
  const { user, refresh } = useApp();
  const router = useRouter();
  const [micBlocked, setMicBlocked] = useState<boolean | null>(null);
  const [host, setHost] = useState("");
  // Mount-only capability probe (navigator APIs don't exist during SSR).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHost(window.location.host || "");
      const secure = window.isSecureContext;
      const hasMic = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      setMicBlocked(!secure || !hasMic);
    } catch {
      setMicBlocked(true);
    }
  }, []);
  const inner = useLiveCoach({
    onDataChanged: () => {
      try { sessionStorage.removeItem(`moneta_tips_${user.id}`); } catch {}
      void refresh();
    },
    onNavigate: (href) => router.push(href),
  });
  // GlobalLiveDock passes its shared session so the sticky button and the
  // expanded panel stay on one mic/WebSocket. Standalone use (e.g. /app/ai)
  // falls back to an owned session. The idle inner hook holds no resources.
  const live = session ?? inner;

  if (micBlocked) {
    return (
      <div className="rounded-[28px] border border-[#ffb35d]/30 bg-[#ffb35d]/[.07] p-6">
        <h3 className="font-display text-[26px]">Voice needs a secure connection</h3>
        <p className="mt-2 text-[14px] font-light leading-relaxed text-ash">
          Your phone blocks the microphone on plain <span className="font-mono">http://</span> addresses.
          One-time fix (30 seconds, stays on your Wi-Fi, nothing leaves your home):
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[14px] font-light text-silver">
          <li>On your phone open <span className="font-mono">chrome://flags</span></li>
          <li>Search <span className="font-mono">Insecure origins treated as secure</span> → Enabled</li>
          <li>Add <span className="font-mono">http://{host || "your-PC-address:3000"}</span> (this server&apos;s address) and relaunch Chrome</li>
        </ol>
        <p className="mt-3 text-[13px] font-light text-fog">iPhone Safari can&apos;t do this — use the phone&apos;s Chrome, or ask for the HTTPS link.</p>
      </div>
    );
  }

  const pillState = live.status === "live" ? (live.speaking ? "speaking" : live.processing ? "thinking" : "listening") : live.status === "connecting" ? "thinking" : "idle";

  function toggle() {
    if (live.status === "live" || live.status === "connecting") live.stop();
    else void live.start();
  }

  return (
    <div className={compact ? "" : "flex min-h-[50dvh] flex-col"}>
      {!compact && (
        <p className="mb-5 max-w-[460px] text-[15px] font-light text-ash">
          Live conversation with your coach — interrupt anytime, it hears you. It can log expenses, set budgets and edit data while you talk.
        </p>
      )}

      <div className="flex-1 space-y-4 py-2">
        {live.turns.length === 0 && !live.liveUser && !live.liveModel && live.status === "idle" && (
          <div className="rounded-[28px] border border-dashed border-white/15 p-6 text-center text-[14px] font-light text-ash">
            Try: “I spent 12 on lunch” — or “where am I overspending?”
          </div>
        )}
        {live.turns.map((m, i) => (
          m.role === "user" ? (
            <div key={i} className="flex animate-pop justify-end">
              <div className="max-w-[85%] rounded-[22px] rounded-br-md bg-white px-4 py-3 text-[15px] text-black">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="animate-pop">
              <div className="min-w-0 flex-1 rounded-[22px] rounded-bl-md border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] font-light leading-relaxed text-silver">
                {m.text || <span className="text-fog">…</span>}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {m.actions.map((a, j) => (
                      <div key={j} className={cn("rounded-lg px-3 py-1.5 text-[13px]", a.ok ? "bg-white/[0.07] text-cloud" : "text-[#ff9a9a]")}>
                        {a.ok ? "✓ " : "✕ "}<span className="font-mono text-[11px] opacity-70">{a.tool}</span><span className="opacity-40"> · </span>{a.summary}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        ))}
        {(live.liveUser || live.liveModel || live.status === "live") && (
          <div className="space-y-2.5">
            {live.liveUser && (
              <div className="flex animate-pop justify-end">
                <div className="max-w-[85%] rounded-[22px] rounded-br-md border border-white/25 bg-white/[0.07] px-4 py-3 text-[15px] text-cloud">
                  {live.liveUser}<span className="ml-1 inline-block h-4 w-[2px] bg-white align-middle" style={{ animation: "blink 1s infinite" }} />
                </div>
              </div>
            )}
            {live.liveModel && (
              <div className="flex animate-pop items-center gap-2.5 rounded-[22px] rounded-bl-md border border-white/10 bg-white/[0.04] px-4 py-3">
                <ListeningBars live />
                <div className="text-[15px] font-light text-silver">{live.liveModel}</div>
              </div>
            )}
            {live.status === "live" && !live.liveUser && !live.liveModel && (
              <p className="label py-2 text-center text-[10px]">Listening — just talk</p>
            )}
          </div>
        )}
        {live.error && <p role="alert" className="rounded-xl border border-[#ff7a7a]/30 bg-[#ff5d5d]/10 px-4 py-3 text-[14px] text-[#ff9a9a]">{live.error}</p>}
        {live.status === "connecting" && <p className="label py-2 text-center text-[10px]">Opening live session…</p>}
      </div>

      <div className={compact ? "flex items-center gap-4 py-3" : "sticky bottom-[112px] z-[45] flex items-center justify-center gap-4 py-4 lg:bottom-6"}>
        <VoicePill
          state={pillState}
          onTap={toggle}
          label={live.status === "idle" ? "Start live talk" : "End live talk"}
        />
        {live.status !== "idle" && (
          <button onClick={() => live.stop()} className="grid h-12 w-12 place-items-center rounded-full border border-white/15 text-ash transition-transform active:scale-90" aria-label="End session">
            <MicOff size={18} />
          </button>
        )}
      </div>
      {live.micLevel > 0.02 && live.status === "live" && (
        <div className="mx-auto mb-2 h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${Math.round(live.micLevel * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
