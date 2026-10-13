"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, Mic, MicOff, RotateCcw, Sparkles, X } from "lucide-react";
import { useApp } from "@/components/app/DataProvider";
import { ThinkingPicker } from "@/components/app/ThinkingPicker";
import { ListeningBars } from "@/components/micro";
import { useLiveCoach } from "@/components/app/useLiveCoach";
import { cn } from "@/components/ui";

type Action = { tool: string; ok: boolean; summary: string; navigate?: string };
type Msg = { role: "user" | "model"; text: string; actions?: Action[]; notice?: string };

const SUGGESTIONS = [
  "Where am I overspending this month?",
  "How can I save 15% more?",
  "Set my dining budget to a realistic number",
  "Add 12 for lunch today",
  "Which subscriptions should I cut?",
  "Create a goal: trip fund, target 1500",
];

function renderInline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-medium text-white">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
  );
}

function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={i} className="space-y-1.5">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2.5"><span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ash" /><span>{renderInline(l.replace(/^\s*[-*•]\s+/, ""))}</span></li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{lines.map((l, j) => <span key={j}>{renderInline(l)}{j < lines.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}

export default function AiPage() {
  const { user, refresh } = useApp();
  const router = useRouter();
  const storeKey = `moneta_chat_${user.id}`;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const sentPrompt = useRef(false);

  const live = useLiveCoach({
    onDataChanged: () => {
      try { sessionStorage.removeItem(`moneta_tips_${user.id}`); } catch {}
      void refresh();
    },
    onNavigate: (href) => router.push(href),
  });
  const liveActive = live.status === "live" || live.status === "connecting";
  const liveState = live.status === "live" ? (live.speaking ? "speaking" : live.processing ? "thinking" : "listening") : live.status === "connecting" ? "thinking" : "idle";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) setMsgs(JSON.parse(raw) as Msg[]);
    } catch {}
    setHydrated(true);
  }, [storeKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify(msgs.slice(-40)));
    } catch {}
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy, hydrated, storeKey, live.turns, live.liveUser, live.liveModel]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text: t }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, text: m.text })) }),
      });
      const j = (await res.json()) as { reply?: string; actions?: Action[]; notice?: string; error?: string };
      setMsgs([...next, { role: "model", text: j.reply ?? j.error ?? "Something went wrong.", actions: j.actions, notice: j.notice }]);
      const nav = j.actions?.find((a) => a.ok && typeof a.navigate === "string" && a.navigate.startsWith("/app"))?.navigate;
      if (j.actions?.some((a) => a.ok)) {
        try { sessionStorage.removeItem(`moneta_tips_${user.id}`); } catch {}
        await refresh();
      }
      if (nav) router.push(nav);
    } catch {
      setMsgs([...next, { role: "model", text: "I couldn't connect. Check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!hydrated || sentPrompt.current) return;
    const p = new URLSearchParams(window.location.search).get("prompt");
    if (p) {
      sentPrompt.current = true;
      window.history.replaceState(null, "", "/app/ai");
      void send(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  function toggleLive() {
    if (live.status === "live" || live.status === "connecting") live.stop();
    else void live.start();
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-[720px] flex-col">
      <header className="mb-4 flex items-end justify-between pt-2">
        <div>
          <div className="label mb-2 flex items-center gap-2"><Sparkles size={12} /> Coach</div>
          <h1 className="font-display text-[40px] sm:text-[48px]">Moneta</h1>
          <p className="mt-1 flex items-center gap-2 text-[13px] font-light text-ash">
            One chat — type or talk.
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
              liveState === "idle" ? "border-white/15 text-fog" : "border-white/40 text-white",
            )}>
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                liveState === "idle" && "bg-white/30",
                liveState === "listening" && "animate-pulse bg-white",
                liveState === "thinking" && "animate-ping bg-white",
                liveState === "speaking" && "animate-pulse bg-white",
              )} />
              {liveState === "idle" && "voice off"}
              {liveState === "listening" && "listening"}
              {liveState === "thinking" && (live.status === "connecting" ? "connecting" : "thinking")}
              {liveState === "speaking" && "speaking"}
            </span>
          </p>
        </div>
        {msgs.length > 0 && (
          <button onClick={() => setMsgs([])} aria-label="New chat" className="mb-1 grid h-10 w-10 place-items-center rounded-full bg-white/[0.07] text-ash hover:text-white"><RotateCcw size={16} /></button>
        )}
      </header>

      <ThinkingPicker />

      {/* Single unified thread: typed messages + live voice turns */}
      <div className="flex-1 space-y-5 py-4">
        {msgs.length === 0 && live.turns.length === 0 && !live.liveUser && !live.liveModel && hydrated && (
          <div className="animate-fade-up">
            <p className="mb-6 max-w-[460px] text-[17px] font-light text-ash">
              I can see your spending, find leaks, and make changes for you — add expenses, set budgets, update goals, bills and categories, change your income, or take you to any page. Type below or tap the mic to talk live.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-white/12 px-4 py-2.5 text-left text-[14px] text-silver transition-colors hover:border-white/40 hover:text-white">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={`t-${i}`} className="flex animate-pop justify-end">
              <div className="max-w-[85%] rounded-[22px] rounded-br-md bg-white px-4 py-3 text-[15px] text-black">{m.text}</div>
            </div>
          ) : (
            <div key={`t-${i}`} className="animate-pop">
              <div className="flex gap-3">
                <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-iris text-white"><Sparkles size={14} /></span>
                <div className="min-w-0 flex-1 text-[15px] font-light leading-relaxed text-silver">
                  <Rich text={m.text} />
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {m.actions.map((a, j) => (
                        <div key={j} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] ${a.ok ? "border-white/10 bg-white/[0.04] text-cloud" : "border-[#ff7a7a]/30 text-[#ff9a9a]"}`}>
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${a.ok ? "bg-white text-black" : "bg-[#ff7a7a] text-black"}`}>{a.ok ? <Check size={12} /> : <X size={12} />}</span>
                          <span className="min-w-0"><span className="font-mono text-[11px] opacity-70">{a.tool}</span><span className="opacity-40"> · </span>{a.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {m.notice && <p className="label mt-3 text-[10px] normal-case tracking-normal text-fog">{m.notice}</p>}
                </div>
              </div>
            </div>
          ),
        )}

        {/* Live voice turns live in the same thread */}
        {live.turns.map((m, i) =>
          m.role === "user" ? (
            <div key={`v-${i}`} className="flex animate-pop justify-end">
              <div className="max-w-[85%] rounded-[22px] rounded-br-md border border-white/25 bg-white/[0.07] px-4 py-3 text-[15px] text-cloud">{m.text}</div>
            </div>
          ) : (
            <div key={`v-${i}`} className="animate-pop">
              <div className="flex gap-3">
                <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-iris text-white"><Mic size={14} /></span>
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
            </div>
          ),
        )}
        {(live.liveUser || live.liveModel) && (
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
          </div>
        )}
        {liveActive && !live.liveUser && !live.liveModel && live.turns.length === 0 && (
          <p className="label py-2 text-center text-[10px]">{live.status === "connecting" ? "Opening live session…" : "Listening — just talk"}</p>
        )}
        {live.error && <p role="alert" className="rounded-xl border border-[#ff7a7a]/30 bg-[#ff5d5d]/10 px-4 py-3 text-[14px] text-[#ff9a9a]">{live.error}</p>}
        {busy && (
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-iris text-white"><Sparkles size={14} /></span>
            <div className="flex gap-1.5 rounded-full bg-white/[0.06] px-4 py-3">
              {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 rounded-full bg-white" style={{ animation: "dots 1.2s infinite", animationDelay: `${d * 0.15}s` }} />)}
            </div>
            <span className="label text-[10px]">Thinking</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* One input bar: live voice toggle + text field + send */}
      <form
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
        className="sticky bottom-[112px] z-[45] flex items-center gap-2 rounded-full border border-white/12 bg-black py-1.5 pl-1.5 pr-1.5 lg:bottom-6"
      >
        <button
          type="button"
          onClick={toggleLive}
          aria-label={liveActive ? "Stop live voice" : "Start live voice"}
          title={liveActive ? "Stop live voice" : "Talk live"}
          className={cn(
            "relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all active:scale-90",
            liveActive ? "bg-white text-black" : "bg-white/[0.07] text-ash",
            liveState === "speaking" && "ring-2 ring-white/60",
          )}
        >
          {liveState === "listening" || liveState === "speaking" ? <ListeningBars dark /> : liveActive ? <MicOff size={18} /> : <Mic size={18} />}
          {liveActive && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#ff5d5d]">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#ff5d5d]/70" />
            </span>
          )}
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={liveActive ? "Talking live — or type here…" : "Where am I overspending this month?"} aria-label="Message Coach" className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fog" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="grid h-10 w-10 place-items-center rounded-full bg-white text-black transition-all active:scale-90 disabled:bg-white/20 disabled:text-white/60">
          <ArrowUp size={18} />
        </button>
      </form>
      {live.micLevel > 0.02 && live.status === "live" && (
        <div className="mx-auto mb-2 h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${Math.round(live.micLevel * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
