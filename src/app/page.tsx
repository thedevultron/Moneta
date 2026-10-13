import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowRight, Mic, PiggyBank, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { all, dbBackend } from "@/db/jsondb";
import { CountUp, Reveal } from "@/components/landing-anim";

export const dynamic = "force-dynamic";

const DISPLAY = "font-[Archivo_Black,'Arial_Black',system-ui,sans-serif]";
const UI = "font-[Inter,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]";

const TICKER = [
  "USD", "EUR", "GBP", "INR", "PKR", "AED", "SAR", "CAD", "AUD", "JPY",
  "BUDGETS", "GOALS", "VOICE AI", "REPORTS", "NO SPREADSHEETS",
];

const CARDS = [
  {
    num: "01",
    icon: Wallet,
    title: "Log in seconds",
    body: "Expenses, income, budgets and recurring bills — one tap, no spreadsheets.",
    footL: "JSON documents",
    footR: "✓ Yours",
  },
  {
    num: "02",
    icon: Sparkles,
    title: "Gemini AI Financial Coach",
    body: "Integrated with Gemini Flash-Lite & Live voice models. Detects invisible money leaks and coaches your spending habits.",
    footL: "AI Studio API",
    footR: "✓ Active",
  },
  {
    num: "03",
    icon: Mic,
    title: "Live voice mode",
    body: "Talk hands-free. Coach hears you, answers out loud, and updates your money while you speak.",
    footL: "Realtime audio",
    footR: "✓ Live",
  },
  {
    num: "04",
    icon: TrendingUp,
    title: "Reports that sting",
    body: "Trends, category breakdowns and savings rate — see exactly where it leaks.",
    footL: "Charts",
    footR: "✓ Sharp",
  },
  {
    num: "05",
    icon: PiggyBank,
    title: "Goals & bills",
    body: "Trip funds, rent-day reminders and monthly limits that keep you honest.",
    footL: "Limits",
    footR: "✓ Firm",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/app");

  const backend = dbBackend();
  let txCount = 0;
  let budgetCount = 0;
  let docCount = 0;
  try {
    const [txs, budgets, cats, goals, recs, users] = await Promise.all([
      all("transactions"),
      all("budgets"),
      all("categories"),
      all("goals"),
      all("recurring"),
      all("users"),
    ]);
    txCount = txs.length;
    budgetCount = budgets.length;
    docCount = txs.length + budgets.length + cats.length + goals.length + recs.length + users.length;
  } catch {
    /* landing never breaks because of stats */
  }
  const engine = backend === "firestore" ? "Cloud Firestore" : "Local JSON";
  const syncedLabel = backend === "firestore" ? "Firestore Synced" : "Local storage";

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#222222] text-[#f8f8f8]">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <div className={UI}>
        <div id="topProgress" className="fixed left-0 top-0 z-[100] h-[2px] w-0 bg-[#f8f8f8]" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('scroll',function(){var h=document.body.scrollHeight-window.innerHeight;var bar=document.getElementById('topProgress');if(bar)bar.style.width=(h>0?(window.scrollY/h)*100:0)+'%';},{passive:true});`,
          }}
        />

        <header className="fixed inset-x-0 top-0 z-90 border-b border-white/[0.18] bg-[#222222]/75 backdrop-blur-2xl">
          <div className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
            <div className={`flex items-center gap-3 ${DISPLAY} text-xl tracking-[-0.02em] sm:text-[22px]`}>
              <span>MONETA</span>
              <span className="rounded-full border border-white/25 px-[9px] py-[3px] font-sans text-[11px] uppercase tracking-[0.1em] text-[#aaa]">
                v2.1
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden items-center gap-2 rounded-full border border-green-500/35 bg-green-500/10 px-3.5 py-1.5 text-xs font-medium text-green-400 sm:inline-flex">
                <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-green-400 shadow-[0_0_10px_#4ade80]" />
                {syncedLabel}
              </span>
              <Link href="/login" className="rounded-full px-2 py-[11px] text-sm font-semibold hover:text-white">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full border border-[#f8f8f8] bg-[#f8f8f8] px-4 py-[11px] text-sm font-semibold text-[#222] transition-colors hover:bg-transparent hover:text-[#f8f8f8] sm:px-[22px]"
              >
                Get started
              </Link>
            </div>
          </div>
        </header>

        <main>
          {/* HERO */}
          <section className="relative mx-auto flex min-h-[96vh] max-w-[1400px] flex-col justify-end overflow-hidden px-5 pb-12 pt-[140px] sm:px-8">
            <div aria-hidden className="animate-float pointer-events-none absolute -left-32 top-24 h-[420px] w-[420px] rounded-full bg-[#847dff]/25 blur-[130px]" />
            <div aria-hidden className="animate-float-slow pointer-events-none absolute -right-32 bottom-0 h-[380px] w-[380px] rounded-full bg-[#dd90d8]/20 blur-[130px]" />
            <div className="animate-fade-up relative mb-6 flex justify-between text-[12px] uppercase tracking-[0.25em] text-[#8e8e93] sm:text-[13px]">
              <span>{engine} · Live</span>
              <span className="hidden sm:inline">Made by Amir Bagawan</span>
            </div>
            <h1
              className={`animate-fade-up relative ${DISPLAY} text-[clamp(72px,17vw,230px)] uppercase leading-[0.88] tracking-[-0.04em]`}
              style={{ animationDelay: "120ms" }}
            >
              <span className="animate-shimmer bg-gradient-to-r from-[#f8f8f8] via-[#d1c9ff] to-[#f8f8f8] bg-[length:200%_auto] bg-clip-text text-transparent">
                Moneta
              </span>
            </h1>
            <div className="animate-fade-up relative mt-10 grid items-end gap-10 border-t border-white/[0.18] pt-9 md:grid-cols-[1.4fr_1fr]" style={{ animationDelay: "240ms" }}>
              <p className="max-w-xl text-[clamp(19px,2.4vw,27px)] leading-[1.4] text-[#e5e5e5]">
                A minimalist daily expense tracker with an AI coach that finds where your money leaks. Money, quietly
                mastered.
              </p>
              <div className="flex flex-wrap gap-3.5">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-full border border-[#f8f8f8] bg-[#f8f8f8] px-[22px] py-[11px] text-sm font-semibold text-[#222] transition-all hover:scale-[1.03] hover:bg-transparent hover:text-[#f8f8f8] active:scale-95"
                >
                  Start free <ArrowRight size={15} />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-white/40 px-[22px] py-[11px] text-sm font-semibold transition-all hover:scale-[1.03] hover:bg-[#f8f8f8] hover:text-[#222] active:scale-95"
                >
                  Log in →
                </Link>
              </div>
            </div>
            <div className="relative mt-12 flex justify-center">
              <span className="grid h-11 w-11 animate-bounce place-items-center rounded-full border border-white/25 text-[#aaa]">
                <ArrowDown size={17} />
              </span>
            </div>
          </section>

          {/* TICKER */}
          <div className="overflow-hidden border-y border-white/[0.18] bg-[#1a1a1a] py-4">
            <div className="animate-marquee flex w-max gap-10 whitespace-nowrap">
              {[...TICKER, ...TICKER].map((t, i) => (
                <span key={i} className="flex items-center gap-10 text-[13px] uppercase tracking-[0.3em] text-[#8e8e93]">
                  {t} <span className="text-[#f8f8f8]">✦</span>
                </span>
              ))}
            </div>
          </div>

          {/* STATS */}
          <section className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 sm:py-[100px]">
            <Reveal>
              <p className="mb-3 text-xs uppercase tracking-[0.25em] text-[#8e8e93]">Infrastructure &amp; data</p>
              <h2 className="max-w-2xl text-[clamp(32px,5vw,56px)] leading-[1.1] tracking-[-0.02em]">
                Your money, <b className={`${DISPLAY} font-normal`}>on your machine.</b>
              </h2>
            </Reveal>

            <Reveal delay={120}>
              <div className="mt-12 grid gap-8 rounded-[28px] border border-white/[0.15] bg-gradient-to-b from-[#1c1c1c] to-[#161616] p-8 sm:grid-cols-2 sm:p-11 lg:grid-cols-4">
                {[
                  [txCount, "Transactions stored"],
                  [budgetCount, "Budget categories"],
                  [docCount, "Documents live"],
                  [null, engine],
                ].map(([v, l]) => (
                  <div key={l as string}>
                    <b className={`${DISPLAY} block text-[clamp(30px,3.4vw,44px)] leading-none text-[#f8f8f8]`}>
                      {typeof v === "number" ? <CountUp to={v} /> : v}
                    </b>
                    <span className="mt-2 block text-[13px] uppercase tracking-[0.15em] text-[#8e8e93]">{l}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            <div className="mt-9 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {CARDS.map((c, i) => (
                <Reveal key={c.num} delay={(i % 3) * 110} className={i === CARDS.length - 1 ? "md:col-span-2 lg:col-span-1" : ""}>
                  <div className="group flex h-full min-h-[280px] flex-col justify-between rounded-3xl border border-white/[0.18] bg-[#1a1a1a] p-8 transition-all duration-300 hover:-translate-y-1.5 hover:border-white/40 hover:shadow-[0_20px_60px_-20px_rgba(132,125,255,0.35)] sm:p-9">
                    <div className="flex items-start justify-between">
                      <span className={`${DISPLAY} text-[32px] text-[#555] transition-colors group-hover:text-[#f8f8f8]`}>
                        {c.num}
                      </span>
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.06] text-[#f8f8f8] transition-colors group-hover:bg-[#f8f8f8] group-hover:text-[#222]">
                        <c.icon size={20} strokeWidth={1.6} />
                      </span>
                    </div>
                    <div className="mt-6">
                      <h3 className="mb-3 text-[22px] font-medium">{c.title}</h3>
                      <p className="text-[15px] leading-[1.6] text-[#8e8e93]">{c.body}</p>
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-[18px] text-[13px] text-[#999]">
                      <span>{c.footL}</span>
                      <span>{c.footR}</span>
                    </div>
                  </div>
                </Reveal>
              ))}
              <Reveal delay={220} className="md:col-span-2 lg:col-span-1">
                <div className="flex h-full min-h-[280px] flex-col justify-between overflow-hidden rounded-3xl bg-[#847dff] p-8 text-white sm:p-9">
                  <p className={`${DISPLAY} text-[clamp(28px,3vw,38px)] uppercase leading-[0.95]`}>
                    Stop guessing where it went.
                  </p>
                  <Link
                    href="/signup"
                    className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-105 active:scale-95"
                  >
                    Create account <ArrowRight size={15} />
                  </Link>
                </div>
              </Reveal>
            </div>
          </section>
        </main>

        <footer className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-5 border-t border-white/[0.18] px-5 py-12 text-[13px] text-[#8e8e93] sm:px-8">
          <div>© Moneta · Made by Amir Bagawan</div>
          <div>
            <Link href="/signup" className="text-[#f8f8f8] underline underline-offset-4">
              Get started
            </Link>
            {" · "}
            <Link href="/login" className="text-[#f8f8f8] underline underline-offset-4">
              Log in
            </Link>
          </div>
          <div>
            <Link href="/sitemap.xml" className="hover:text-[#f8f8f8]">
              Sitemap
            </Link>
            {" · "}
            <Link href="/robots.txt" className="hover:text-[#f8f8f8]">
              Robots
            </Link>
            {" · "}
            <Link href="/quest.html" className="hover:text-[#f8f8f8]">
              Quest
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
