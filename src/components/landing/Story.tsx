"use client";

import {
  AnimatePresence, motion, useInView, useMotionValueEvent, useScroll, useTransform, type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Check, Globe2, GraduationCap, PieChart, Repeat, Sparkles, Target, TrendingUp } from "lucide-react";
import { AnimatedNumber } from "@/components/ui";
import { CURRENCIES } from "@/lib/currency";
import { PhoneFrame, ScreenAdd, ScreenBudgets, ScreenCoach } from "@/components/landing/Phone";

const EASE = [0.22, 1, 0.36, 1] as const;

function Eyebrow({ n, children }: { n: string; children: string }) {
  return (
    <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.08] px-5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white">
      <span className="text-ash">{n}</span>
      <span className="h-3 w-px bg-white/25" />
      {children}
    </div>
  );
}

/* ───────── Chapter 1 — scroll-linked text reveal ───────── */

const LEAK =
  "Nobody overspends on the big things. It leaks out through the small ones — a coffee, a forgotten subscription, a late-night order. By the end of the month, it's simply gone.";

function Word({ w, i, n, p }: { w: string; i: number; n: number; p: MotionValue<number> }) {
  const start = (i / n) * 0.78;
  const opacity = useTransform(p, [start, start + 0.07], [0.12, 1]);
  const y = useTransform(p, [start, start + 0.07], [8, 0]);
  return (
    <motion.span style={{ opacity, y }} className="mr-[0.26em] inline-block">
      {w}
    </motion.span>
  );
}

export function Leak() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const words = LEAK.split(" ");
  const amount = useTransform(p, [0.05, 0.92], [0, 312]);
  const text = useTransform(amount, (v) => Math.round(v).toString());
  const barW = useTransform(p, [0, 1], ["0%", "100%"]);
  return (
    <section id="story" ref={ref} className="relative h-[340vh]">
      <div className="sticky top-0 flex h-dvh flex-col justify-center overflow-hidden px-6 sm:px-10">
        <div className="mx-auto w-full max-w-[1100px]">
          <Eyebrow n="01">The leak</Eyebrow>
          <p className="font-display text-[30px] leading-[1.08] sm:text-[48px] sm:leading-[1.06] lg:text-[80px]">
            {words.map((w, i) => (
              <Word key={i} w={w} i={i} n={words.length} p={p} />
            ))}
          </p>
          <div className="mt-6 flex items-end justify-between gap-6 border-t border-white/10 pt-5 sm:mt-10 sm:pt-6">
            <div>
              <div className="label mb-2 text-[10px]">Average small spends you never noticed</div>
              <div className="font-display tabular text-[44px] leading-none sm:text-[72px] lg:text-[88px]">
                <span className="text-ash">$</span>
                <motion.span>{text}</motion.span>
                <span className="ml-2 font-mono text-[12px] uppercase tracking-widest text-ash">/ month</span>
              </div>
            </div>
            <div className="hidden h-px w-1/3 bg-white/10 sm:block"><motion.div style={{ width: barW }} className="h-px bg-white" /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Chapter 2 — sticky phone journey ───────── */

const STEPS = [
  { n: "02", k: "Capture", t: "Log it in ten seconds.", d: "Tap, type, done. Entries land instantly — even on a slow connection — and sync quietly in the background." },
  { n: "03", k: "Understand", t: "Watch the month take shape.", d: "Budgets fill in real time. Colour-coded categories show where your money went, and where it's heading." },
  { n: "04", k: "Ask", t: "Then just ask your coach.", d: "Why was March so expensive? What if I stop ordering in? Plain English in, specific savings out." },
];

export function Journey() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(p, "change", (v) => setStep(Math.min(2, Math.max(0, Math.floor(v * 3)))));
  const rotY = useTransform(p, [0, 0.5, 1], [-16, 6, 16]);
  const rotX = useTransform(p, [0, 1], [8, 0]);
  const lift = useTransform(p, [0, 1], [30, -30]);
  return (
    <section id="journey" ref={ref} className="relative h-[420vh]">
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
        <div aria-hidden className="absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 animate-float rounded-full bg-deep-iris/40 blur-[130px]" />
        <div className="relative mx-auto grid w-full max-w-[1100px] items-center gap-1 px-6 sm:grid-cols-2 sm:gap-10 sm:px-10 lg:gap-16">
          <div className="order-1 flex h-[320px] justify-center [@media(max-height:600px)]:hidden sm:order-2 sm:h-[400px] lg:h-[580px]" style={{ perspective: 1400 }}>
            <motion.div style={{ rotateY: rotY, rotateX: rotX, y: lift }} className="origin-top scale-[0.52] sm:origin-center sm:scale-[0.65] lg:scale-100">
              <PhoneFrame>
                {[
                  <ScreenAdd key="a" active={step === 0} />,
                  <ScreenBudgets key="b" active={step === 1} />,
                  <ScreenCoach key="c" active={step === 2} />,
                ].map((s, i) => (
                  <div key={i} className={`absolute inset-0 transition-all duration-700 ${step === i ? "scale-100 opacity-100" : "pointer-events-none scale-[0.96] opacity-0"}`}>{s}</div>
                ))}
              </PhoneFrame>
            </motion.div>
          </div>
          <div className="order-2 sm:order-1">
            <div className="relative h-[170px] sm:h-[300px] lg:h-[260px]">
              {STEPS.map((s, i) => (
                <motion.div
                  key={s.n}
                  animate={{ opacity: step === i ? 1 : 0, y: step === i ? 0 : step > i ? -30 : 30, filter: step === i ? "blur(0px)" : "blur(8px)" }}
                  transition={{ duration: 0.7, ease: EASE }}
                  className="absolute inset-0"
                  aria-hidden={step !== i}
                >
                  <Eyebrow n={s.n}>{s.k}</Eyebrow>
                  <h2 className="font-display text-[32px] leading-[1.05] sm:text-[40px] lg:text-[64px]">{s.t}</h2>
                  <p className="mt-3 max-w-[440px] text-[15px] font-light leading-relaxed text-ash sm:text-[16px] lg:mt-4 lg:text-[18px]">{s.d}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              {STEPS.map((_, i) => (
                <span key={i} className={`h-[3px] rounded-full transition-all duration-500 ${i === step ? "w-12 bg-white" : "w-6 bg-white/20"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Chapter 3 — AI coach demo that plays on view ───────── */

const ACTIONS = ["Budget set · Dining $208 / month", "Cancelled-sub reminder · Cloud storage $9.99", "Goal created · Lisbon trip $2,400"];

export function CoachDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const [stage, setStage] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!inView) return;
    setStage(0);
    const ts = [
      setTimeout(() => setStage(1), 300),
      setTimeout(() => setStage(2), 1400),
      setTimeout(() => setStage(3), 3000),
      setTimeout(() => setStage(4), 3700),
      setTimeout(() => setStage(5), 4400),
      setTimeout(() => setStage(6), 5300),
    ];
    return () => ts.forEach(clearTimeout);
  }, [inView, run]);

  const tips = [
    ["Dining out", "−$64", "Cap takeaways at two a week."],
    ["Subscriptions", "−$41", "Three you haven't opened in 60 days."],
    ["Small buys", "−$38", "11 purchases under $5 — batch them."],
  ];

  return (
    <section id="coach" ref={ref} className="relative px-6 py-32 sm:px-10 sm:py-48">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="mx-auto max-w-[1100px]">
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 1, ease: EASE }} className="mb-16 max-w-[760px]">
          <Eyebrow n="05">AI Coach</Eyebrow>
          <h2 className="font-display text-[48px] sm:text-[88px]">An AI that doesn&apos;t just advise. <em>It acts.</em></h2>
          <p className="mt-6 max-w-[540px] text-[17px] font-light leading-relaxed text-ash sm:text-[19px]">
            Powered by Gemini. Your coach reads your real numbers, finds the leaks, and can change your income, add costs, set budgets and create goals — just by being asked. Type it in <a href="/app/ai" className="text-white underline underline-offset-4 hover:opacity-80">Coach chat</a> or say it in <a href="/app/ai" className="text-white underline underline-offset-4 hover:opacity-80">Voice mode</a>.
          </p>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-card p-5 sm:p-8">
            <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-iris/25 blur-[90px]" />
            <div className="relative min-h-[410px] space-y-4 text-[15px]">
              <AnimatePresence>
                {stage >= 1 && (
                  <motion.div key="u" initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: EASE }} className="flex justify-end">
                    <div className="max-w-[82%] rounded-[22px] rounded-br-md bg-white px-4 py-3 text-black">Dining is out of control. Cut it by 20%, and start a Lisbon trip fund.</div>
                  </motion.div>
                )}
                {stage === 2 && (
                  <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-iris"><Sparkles size={14} /></span>
                    <div className="flex gap-1.5 rounded-full bg-white/[0.06] px-4 py-3">
                      {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 rounded-full bg-white" style={{ animation: "dots 1.2s infinite", animationDelay: `${d * 0.15}s` }} />)}
                    </div>
                    <span className="label text-[10px]">Thinking · medium</span>
                  </motion.div>
                )}
              </AnimatePresence>
              {stage >= 3 && (
                <div className="ml-11 space-y-2">
                  {ACTIONS.map((a, i) => stage >= 3 + (i === 0 ? 0 : i === 1 ? 1 : 2) && (
                    <motion.div key={a} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: EASE }} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-cloud">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-black"><Check size={12} /></span>{a}
                    </motion.div>
                  ))}
                </div>
              )}
              {stage >= 6 && (
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="flex gap-3">
                  <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-iris"><Sparkles size={14} /></span>
                  <div className="font-light leading-relaxed text-silver">
                    Done. Dining now caps at <b className="font-medium text-white">$208</b> — about <b className="font-medium text-white">$52</b> less a month. Put that into Lisbon and you&apos;ll hit <b className="font-medium text-white">$2,400</b> in 14 months.
                  </div>
                </motion.div>
              )}
            </div>
            <button onClick={() => setRun((r) => r + 1)} className="relative mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ash transition-colors hover:text-white">↻ Replay</button>
          </div>

          <div className="space-y-3">
            {tips.map(([t, s, d], i) => (
              <motion.div key={t} initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.9, delay: i * 0.14, ease: EASE }} className="flex items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-card p-6">
                <div>
                  <div className="label mb-2 text-[10px]">{t}</div>
                  <div className="text-[15px] font-light text-silver">{d}</div>
                </div>
                <div className="font-display text-[44px] leading-none">{s}<span className="ml-1 font-mono text-[10px] uppercase text-ash">/mo</span></div>
              </motion.div>
            ))}
            <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.5, ease: EASE }} className="rounded-[24px] bg-iris p-6 text-white">
              <div className="label !text-white/70">Together</div>
              <div className="font-display mt-1 text-[56px] leading-none">$143 <span className="font-mono text-[11px] uppercase tracking-widest text-white/70">freed each month</span></div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Chapter 4 — feature tiles ───────── */

const TILES = [
  { icon: PieChart, t: "Budgets that breathe", d: "Set a limit, watch it fill, get nudged before you cross it.", bg: "#847dff", ink: "#fff" },
  { icon: Target, t: "Goals with a date", d: "See exactly what to save each month to land the trip, the laptop, the safety net.", bg: "#dd90d8", ink: "#0f1011" },
  { icon: Repeat, t: "Recurring, tamed", d: "Rent, subscriptions and phone plans in one calm list — pause or log with a tap.", bg: "#90b8f0", ink: "#0f1011" },
  { icon: TrendingUp, t: "Reports worth reading", d: "Six-month trends, category breakdowns, one-tap CSV export.", bg: "#d1c9ff", ink: "#0f1011" },
  { icon: Globe2, t: "Your currency", d: "USD, GBP, EUR, INR, CAD and 19 more — convert existing data in a tap.", bg: "#4b49aa", ink: "#fff" },
  { icon: GraduationCap, t: "Student or adult", d: "Tuition and coffee, or rent and renters' insurance — categories that fit your life.", bg: "#cacaca", ink: "#000" },
];

export function Features() {
  return (
    <section id="features" className="relative px-6 py-28 sm:px-10 sm:py-44">
      <div className="mx-auto max-w-[1100px]">
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 1, ease: EASE }} className="mb-14 text-center">
          <div className="flex justify-center"><Eyebrow n="06">Everything</Eyebrow></div>
          <h2 className="font-display mx-auto max-w-[800px] text-[46px] sm:text-[80px]">Quiet on the surface. <em>Complete underneath.</em></h2>
        </motion.div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t, i) => (
            <motion.div
              key={t.t}
              initial={{ opacity: 0, y: 70, rotate: i % 2 ? 2 : -2, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 1, delay: (i % 3) * 0.1, ease: EASE }}
              whileHover={{ y: -8 }}
              className="group flex min-h-[270px] flex-col justify-between rounded-[30px] p-8"
              style={{ background: t.bg, color: t.ink }}
            >
              <t.icon size={30} strokeWidth={1.3} className="transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-110" />
              <div>
                <h3 className="font-display text-[38px] leading-[0.95]">{t.t}</h3>
                <p className="mt-3 text-[15px] leading-relaxed opacity-80">{t.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CurrencyMarquee() {
  const row = (rev: boolean) => (
    <div className="flex w-max animate-marquee gap-12 whitespace-nowrap py-2" style={rev ? { animationDirection: "reverse", animationDuration: "46s" } : undefined}>
      {[...CURRENCIES, ...CURRENCIES].map((c, i) => (
        <span key={i} className="font-display flex items-baseline gap-4 text-[56px] text-white/90 sm:text-[88px]">
          <em className="text-white/30">{c.symbol}</em>
          <span>{c.code}</span>
        </span>
      ))}
    </div>
  );
  return (
    <section aria-label="Supported currencies" className="relative overflow-hidden py-16 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      {row(false)}
      {row(true)}
    </section>
  );
}

export function Proof() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const stats: [number, string, string, string][] = [
    [CURRENCIES.length, "", "currencies", "from USD to IDR"],
    [10, "s", "to log an expense", "tap, type, done"],
    [0, "", "bank passwords", "you stay in control"],
  ];
  return (
    <section ref={ref} className="px-6 py-10 sm:px-10">
      <motion.div initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 1, ease: EASE }} className="mx-auto max-w-[1100px] rounded-[30px] bg-silver p-8 text-black sm:p-14">
        <h2 className="font-display max-w-[720px] text-[40px] sm:text-[68px]">Built for the first paycheck <em>and the fiftieth.</em></h2>
        <div className="mt-12 grid gap-8 border-t border-black/15 pt-8 sm:grid-cols-3">
          {stats.map(([v, suf, l, s]) => (
            <div key={l}>
              <div className="font-display text-[64px] leading-none sm:text-[84px]">
                <AnimatedNumber value={inView ? v : 0} format={(x) => Math.round(x).toString()} />{suf}
              </div>
              <div className="mt-2 text-[16px]">{l}</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/50">{s}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

