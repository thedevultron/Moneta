"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Logo } from "@/components/app/Logo";
import { GradualBlur } from "@/components/GradualBlur";
import { CoachDemo, CurrencyMarquee, Features, Journey, Leak, Proof } from "@/components/landing/Story";
import { PhoneFrame, ScreenHome } from "@/components/landing/Phone";

const EASE = [0.22, 1, 0.36, 1] as const;

function useDemo() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona: "adult", currency: "USD" }) });
      if (!res.ok) throw new Error();
      router.push("/app");
    } catch {
      setBusy(false);
      router.push("/login");
    }
  }
  return { busy, start };
}

export function Landing({ loggedIn }: { loggedIn: boolean }) {
  const { busy, start } = useDemo();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28 });

  return (
    <div className="relative bg-obsidian">
      {/* scroll progress */}
      <motion.div style={{ scaleX: progress }} className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-white" />

      {/* nav */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-28"><GradualBlur position="top" /></div>
      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <div className="glass mx-auto flex h-14 max-w-[1100px] items-center justify-between rounded-2xl pl-4 pr-2">
          <Link href="/" className="flex items-center gap-2.5"><Logo size={26} /><span className="font-display text-[24px]">Moneta</span></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {[["Story", "#story"], ["Journey", "#journey"], ["Coach", "#coach"], ["Features", "#features"]].map(([l, h]) => (
              <a key={h} href={h} className="rounded-lg px-4 py-2 text-[14px] text-ash transition-colors hover:text-white">{l}</a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            {!loggedIn && <Link href="/login" className="rounded-lg px-3 py-2 text-[14px] text-silver transition-colors hover:text-white">Log in</Link>}
            <Link href={loggedIn ? "/app" : "/signup"} className="group inline-flex h-10 items-center gap-1.5 rounded-lg bg-white px-4 text-[14px] text-black transition-transform active:scale-95">
              {loggedIn ? "Open app" : "Get started"} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      <Hero loggedIn={loggedIn} busy={busy} onDemo={start} />
      <Leak />
      <Journey />
      <CoachDemo />
      <CurrencyMarquee />
      <Features />
      <Proof />
      <Closing loggedIn={loggedIn} busy={busy} onDemo={start} />
      <Footer />
    </div>
  );
}

function Cta({ loggedIn, busy, onDemo, center }: { loggedIn: boolean; busy: boolean; onDemo: () => void; center?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${center ? "items-center justify-center" : ""}`}>
      <Link href={loggedIn ? "/app" : "/signup"} className="group inline-flex h-[52px] items-center justify-center gap-2 rounded-lg bg-white px-6 text-base text-black transition-transform duration-200 active:scale-[0.98]">
        {loggedIn ? "Open your dashboard" : "Get started — it's free"} <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
      </Link>
      <button onClick={onDemo} disabled={busy} className="inline-flex h-[52px] items-center justify-center gap-2 rounded-lg border border-white/25 px-6 text-base text-white transition-colors hover:bg-white/10 disabled:opacity-60">
        {busy ? "Preparing demo…" : "Try the live demo"}
      </button>
    </div>
  );
}

function Hero({ loggedIn, busy, onDemo }: { loggedIn: boolean; busy: boolean; onDemo: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(p, [0, 1], [0, -160]);
  const textO = useTransform(p, [0, 0.6], [1, 0]);
  const phoneY = useTransform(p, [0, 1], [0, -220]);
  const phoneS = useTransform(p, [0, 1], [1, 1.12]);
  const phoneR = useTransform(p, [0, 1], [0, -6]);
  const blobY = useTransform(p, [0, 1], [0, 200]);
  const words = ["Know", "where", "your", "money", "goes."];

  return (
    <section ref={ref} className="relative overflow-hidden px-6 pb-24 pt-32 sm:pt-40">
      {/* sky atmosphere */}
      <motion.div aria-hidden style={{ y: blobY }} className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[1100px]" style={{ background: "linear-gradient(rgb(15,16,17), #1a1440 20%, #4b49aa 52%, rgb(15,16,17) 100%)", opacity: 0.6 }} />
        <div className="absolute -left-32 top-24 h-[420px] w-[420px] animate-float rounded-full bg-iris/35 blur-[110px]" />
        <div className="absolute -right-32 top-[420px] h-[460px] w-[460px] animate-float-slow rounded-full bg-cyan-signal/20 blur-[120px]" />
      </motion.div>
      <div aria-hidden className="noise pointer-events-none absolute inset-0" />

      <motion.div style={{ y: textY, opacity: textO }} className="relative mx-auto flex max-w-[1000px] flex-col items-center text-center">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.1, ease: EASE }} className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/[0.12] px-5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> AI expense coach · students &amp; adults
        </motion.div>
        <h1 className="font-display text-[60px] sm:text-[112px] lg:text-[128px]" style={{ lineHeight: 0.92 }} aria-label="Know where your money goes.">
          {words.map((w, i) => (
            <motion.span
              key={w}
              aria-hidden
              initial={{ opacity: 0, y: 60, filter: "blur(14px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1.3, delay: 0.25 + i * 0.13, ease: EASE }}
              className={`mr-[0.2em] inline-block last:mr-0 ${i === 4 ? "italic" : ""}`}
            >
              {w}
            </motion.span>
          ))}
        </h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 1.0, ease: EASE }} className="mt-8 max-w-[560px] text-[17px] font-light leading-relaxed text-ash sm:text-[20px]">
          Moneta tracks every expense in seconds — then an AI coach shows you exactly how to spend less, and fixes your budget for you.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 1.2, ease: EASE }} className="mt-10 w-full sm:w-auto">
          <Cta loggedIn={loggedIn} busy={busy} onDemo={onDemo} center />
        </motion.div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 120 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 2.2, delay: 1.0, ease: [0.455, 0.03, 0.515, 0.955] }} className="relative mt-20 flex justify-center">
        <motion.div style={{ y: phoneY, scale: phoneS, rotate: phoneR }} className="relative">
          <PhoneFrame><ScreenHome /></PhoneFrame>
          {/* floating chips */}
          <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="glass absolute -left-16 top-24 hidden rounded-2xl px-4 py-3 sm:block">
            <div className="label text-[9px]">Just now</div>
            <div className="text-[14px]">Coffee <span className="ml-2 text-ash">−$4.50</span></div>
          </motion.div>
          <motion.div animate={{ y: [0, 14, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} className="glass absolute -right-20 top-52 hidden rounded-2xl px-4 py-3 sm:block">
            <div className="label text-[9px]">Coach</div>
            <div className="text-[14px]">Save <span className="font-display text-[20px]">$143</span> / mo</div>
          </motion.div>
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="glass absolute -left-10 bottom-24 hidden rounded-2xl px-4 py-3 md:block">
            <div className="label text-[9px]">Budget</div>
            <div className="text-[14px]">Dining <span className="ml-2 text-[#ff9a9a]">94%</span></div>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.a href="#story" aria-label="Scroll to story" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4, duration: 1 }} className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-ash sm:flex">
        <span className="label text-[10px]">Scroll</span>
        <ChevronDown size={16} className="animate-bounce" />
      </motion.a>
    </section>
  );
}

function Closing({ loggedIn, busy, onDemo }: { loggedIn: boolean; busy: boolean; onDemo: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const scale = useTransform(p, [0, 1], [0.7, 1]);
  const opacity = useTransform(p, [0, 0.6], [0, 1]);
  const blur = useTransform(p, [0, 0.8], ["blur(18px)", "blur(0px)"]);
  const glow = useTransform(p, [0, 1], [0.2, 0.9]);
  return (
    <section ref={ref} className="relative overflow-hidden px-6 py-40 text-center sm:py-64">
      <motion.div aria-hidden style={{ opacity: glow }} className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-iris/40 blur-[140px]" />
      <motion.div style={{ scale, opacity, filter: blur }} className="relative mx-auto max-w-[1000px]">
        <h2 className="font-display text-[64px] sm:text-[128px]" style={{ lineHeight: 0.92 }}>
          Your money, finally <em>quiet.</em>
        </h2>
        <p className="mx-auto mt-8 max-w-[480px] text-[18px] font-light text-ash">Start in under a minute. Or explore a fully-loaded demo first — no sign-up needed.</p>
        <div className="mt-10"><Cta loggedIn={loggedIn} busy={busy} onDemo={onDemo} center /></div>
      </motion.div>
    </section>
  );
}

function Footer() {
  const story: [string, string][] = [["Story", "#story"], ["Journey", "#journey"], ["Coach", "#coach"], ["Features", "#features"]];
  const app: [string, string][] = [["Dashboard", "/app"], ["Transactions", "/app/transactions"], ["Budgets", "/app/budgets"], ["Coach", "/app/ai"], ["Reports", "/app/reports"], ["Goals", "/app/goals"], ["Settings", "/app/settings"]];
  const auth: [string, string][] = [["Log in", "/login"], ["Sign up", "/signup"], ["Onboarding", "/onboarding"]];
  return (
    <footer className="border-t border-white/10 bg-abyss px-6 py-14 sm:px-10">
      <div className="mx-auto grid max-w-[1100px] gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5"><Logo size={30} /><span className="font-display text-[30px]">Moneta</span></div>
          <p className="mt-3 max-w-[320px] text-[14px] font-light text-ash">A calm, minimalist expense tracker for students and adults — with an AI coach that finds the leaks.</p>
          <div className="mt-5 flex gap-2">
            <Link href="/signup" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-white px-4 text-[14px] text-black transition-transform active:scale-95">Get started <ArrowRight size={15} /></Link>
            <Link href="/login" className="inline-flex h-10 items-center rounded-lg border border-white/20 px-4 text-[14px] text-white hover:bg-white/10">Log in</Link>
          </div>
        </div>
        <nav aria-label="Story">
          <div className="label mb-4 text-[10px]">Story</div>
          <ul className="space-y-2.5 text-[14px] text-ash">{story.map(([l, h]) => (<li key={h}><a href={h} className="hover:text-white">{l}</a></li>))}</ul>
        </nav>
        <nav aria-label="App">
          <div className="label mb-4 text-[10px]">App</div>
          <ul className="space-y-2.5 text-[14px] text-ash">{app.map(([l, h]) => (<li key={h}><Link href={h} className="hover:text-white">{l}</Link></li>))}</ul>
        </nav>
        <nav aria-label="Account">
          <div className="label mb-4 text-[10px]">Account</div>
          <ul className="space-y-2.5 text-[14px] text-ash">{auth.map(([l, h]) => (<li key={h}><Link href={h} className="hover:text-white">{l}</Link></li>))}</ul>
        </nav>
      </div>
      <div className="mx-auto mt-12 flex max-w-[1100px] flex-col gap-2 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="label text-[10px]">© {new Date().getFullYear()} Moneta · Made by Amir Bagawan</p>
        <p className="font-mono text-[11px] text-fog">Money, quietly mastered.</p>
      </div>
    </footer>
  );
}
