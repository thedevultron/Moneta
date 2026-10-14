"use client";

import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";

export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative h-[580px] w-[280px] shrink-0 rounded-[46px] border border-white/15 p-[9px] ${className}`}
      style={{ background: "linear-gradient(135deg, rgb(43,43,44), rgb(19,19,19))", boxShadow: "0 40px 90px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset" }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[38px] bg-obsidian">
        <div className="absolute left-1/2 top-2.5 z-20 h-[22px] w-[78px] -translate-x-1/2 rounded-full bg-black" />
        {children}
      </div>
    </div>
  );
}

const pill = "rounded-full bg-white/10 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[#cacaca]";

export function ScreenHome() {
  return (
    <div className="h-full px-4 pt-11 text-left">
      <div className="label text-[8px]">Spent this month</div>
      <div className="font-display mt-1 text-[48px] leading-none">$1,842</div>
      <span className={`${pill} mt-2 inline-block`}>↓ 12% vs last month</span>
      <svg viewBox="0 0 240 90" className="mt-3 h-[84px] w-full overflow-visible">
        <defs>
          <linearGradient id="hg" x1="0" x2="1">
            <stop offset="0" stopColor="#847dff" /><stop offset=".45" stopColor="#d1c9ff" /><stop offset="1" stopColor="#847dff" />
          </linearGradient>
        </defs>
        <path d="M0 80 C20 78 28 60 48 62 S80 50 100 42 S140 48 160 30 S210 22 240 10" fill="none" stroke="rgba(255,255,255,.2)" strokeDasharray="3 4" />
        <motion.path
          d="M0 84 C24 80 34 66 56 64 S92 56 112 44 S150 40 172 26 S214 16 236 8"
          fill="none" stroke="url(#hg)" strokeWidth="2" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.6, ease: [0.22, 1, 0.36, 1], delay: 0.8 }}
        />
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[["Food", "$412", "#847dff", "#fff"], ["Rent", "$1.4k", "#dd90d8", "#0f1011"], ["Transit", "$96", "#90b8f0", "#0f1011"]].map(([n, v, bg, ink]) => (
          <div key={n} className="rounded-[18px] p-2.5" style={{ background: bg, color: ink }}>
            <div className="h-4 w-4 rounded-full" style={{ background: ink, opacity: 0.25 }} />
            <div className="mt-5 text-[9px] opacity-80">{n}</div>
            <div className="font-display text-[17px] leading-none">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-[20px] bg-iris p-3 text-white">
        <div className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-widest"><Sparkles size={8} /> Coach</div>
        <div className="font-display mt-1.5 text-[18px] leading-[1.05]">Takeaways are up 34%.</div>
        <div className="mt-1 text-[9px] text-white/80">Cap at 2 a week — save ~$64/mo.</div>
      </div>
    </div>
  );
}

export function ScreenAdd({ active }: { active: boolean }) {
  const full = "12.50";
  const [n, setN] = useState(0);
  // Typewriter reset + interval keyed on visibility (animation lifecycle, not derived state).
  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setN(0);
      return;
    }
    let i = 0;
    const t = setInterval(() => {
      i++;
      setN(i);
      if (i >= full.length) clearInterval(t);
    }, 160);
    return () => clearInterval(t);
  }, [active]);
  return (
    <div className="h-full px-4 pt-11 text-left">
      <div className="font-display text-[22px]">New transaction</div>
      <div className="mt-3 flex rounded-lg bg-white/[0.06] p-0.5 text-center text-[10px]">
        <div className="flex-1 rounded-md bg-white py-1.5 text-black">Expense</div>
        <div className="flex-1 py-1.5 text-[#9f9fa0]">Income</div>
      </div>
      <div className="mt-6 flex items-baseline justify-center gap-1">
        <span className="font-display text-[26px] text-[#9f9fa0]">$</span>
        <span className="font-display text-[58px] leading-none">{full.slice(0, n) || <span className="text-steel">0</span>}</span>
        <span className="ml-0.5 inline-block h-9 w-px animate-[blink_1s_infinite] bg-white" />
      </div>
      <div className="mt-5 rounded-lg border border-white/10 bg-black px-3 py-2.5 text-[11px] text-[#cacaca]">Lunch at Pret</div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {[["Dining", "#dd90d8", true], ["Food", "#8fb8a0"], ["Transit", "#00b3dd"], ["Fun", "#90b8f0"]].map(([n2, c, on]) => (
          <div key={String(n2)} className="rounded-xl border p-2 text-center text-[8px]" style={on ? { background: String(c), color: "#0f1011", borderColor: String(c) } : { borderColor: "rgba(255,255,255,.1)", color: "#cacaca" }}>
            <div className="mx-auto mb-1.5 h-3.5 w-3.5 rounded-full" style={{ background: on ? "#0f1011" : String(c), opacity: on ? 0.3 : 0.9 }} />
            {n2}
          </div>
        ))}
      </div>
      <div className="mt-5 flex h-10 items-center justify-center rounded-lg bg-white text-[12px] text-black">Add transaction →</div>
    </div>
  );
}

export function ScreenBudgets({ active }: { active: boolean }) {
  const rows: [string, number, string][] = [["Groceries", 62, "#8fb8a0"], ["Dining", 94, "#dd90d8"], ["Transport", 38, "#00b3dd"], ["Fun", 71, "#90b8f0"]];
  return (
    <div className="h-full px-4 pt-11 text-left">
      <div className="font-display text-[22px]">Budgets</div>
      <div className="mt-4 flex items-center gap-4 rounded-[22px] border border-white/[0.06] bg-card p-3.5">
        <svg width="70" height="70" className="-rotate-90">
          <circle cx="35" cy="35" r="30" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="6" />
          <motion.circle cx="35" cy="35" r="30" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeDasharray="188" animate={{ strokeDashoffset: active ? 188 * (1 - 0.72) : 188 }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />
        </svg>
        <div>
          <div className="label text-[8px]">Left to spend</div>
          <div className="font-display text-[30px] leading-none">$624</div>
          <div className="mt-1 text-[9px] text-[#9f9fa0]">≈ $31 a day</div>
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        {rows.map(([n, v, c], i) => (
          <div key={n} className="rounded-2xl border border-white/[0.06] bg-card p-3">
            <div className="flex justify-between text-[10px]"><span>{n}</span><span className={v > 90 ? "text-[#ff9a9a]" : "text-[#9f9fa0]"}>{v > 90 ? "Close" : `${v}%`}</span></div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full" style={{ background: c }} animate={{ width: active ? `${v}%` : "0%" }} transition={{ duration: 1.2, delay: 0.25 + i * 0.12, ease: [0.22, 1, 0.36, 1] }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScreenCoach({ active }: { active: boolean }) {
  const show = (d: number) => ({ opacity: active ? 1 : 0, y: active ? 0 : 14, transition: { duration: 0.6, delay: active ? d : 0 } });
  return (
    <div className="h-full px-4 pt-11 text-left">
      <div className="label flex items-center gap-1 text-[8px]"><Sparkles size={8} /> AI Coach</div>
      <div className="font-display mt-1 text-[24px]">Ask <em>anything</em></div>
      <div className="mt-4 space-y-3">
        <motion.div animate={show(0.2)} className="ml-auto w-[78%] rounded-2xl rounded-br-md bg-white px-3 py-2 text-[10px] text-black">Why was March so expensive?</motion.div>
        <motion.div animate={show(1.0)} className="flex gap-2">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-iris text-white"><Sparkles size={9} /></span>
          <div className="text-[10px] font-light leading-relaxed text-[#cacaca]">
            Dining rose <b className="font-medium text-white">34%</b>, mostly weekend takeaways.
            <div className="mt-1.5 space-y-1">
              <div>– 11 delivery orders, avg <b className="font-medium text-white">$23</b></div>
              <div>– 3 unused subscriptions: <b className="font-medium text-white">$41/mo</b></div>
            </div>
          </div>
        </motion.div>
        <motion.div animate={show(2.0)} className="ml-7 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[9px]">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-[8px] text-black">✓</span> Budget set · Dining $210
        </motion.div>
      </div>
    </div>
  );
}
