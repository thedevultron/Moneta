import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Mic, PiggyBank, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: Wallet,
    title: "Log in seconds",
    body: "Expenses, income, budgets and recurring bills — one tap, no spreadsheets.",
  },
  {
    icon: Sparkles,
    title: "AI Coach that acts",
    body: "Ask in plain words. Coach reads your numbers and makes the change: add costs, set budgets, create goals.",
  },
  {
    icon: Mic,
    title: "Live voice mode",
    body: "Talk hands-free. Coach hears you, answers out loud, and updates your money while you speak.",
  },
  {
    icon: TrendingUp,
    title: "Reports that sting",
    body: "Trends, category breakdowns and savings rate — see exactly where it leaks.",
  },
  {
    icon: PiggyBank,
    title: "Goals & bills",
    body: "Trip funds, rent day reminders and monthly limits that keep you honest.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/app");

  return (
    <div className="min-h-dvh bg-obsidian text-cloud">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <span className="font-serif text-2xl tracking-tight">Moneta</span>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm text-silver transition-colors hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-transform active:scale-95"
          >
            Get started <ArrowRight size={15} />
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        <section className="animate-fade-up pb-14 pt-10 text-center sm:pt-16">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">
            <Sparkles size={12} /> AI money coach inside
          </p>
          <h1 className="mx-auto max-w-3xl font-serif text-5xl leading-[1.04] tracking-tight sm:text-7xl">
            Money, quietly mastered.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[17px] font-light leading-relaxed text-ash">
            Track every expense in seconds. An AI coach shows you exactly how to
            spend less — and does the boring parts for you.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-medium text-black transition-transform active:scale-95"
            >
              Start free <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-[15px] text-cloud transition-colors hover:bg-white/[0.06]"
            >
              I have an account
            </Link>
          </div>
        </section>

        <section className="grid gap-3 pb-16 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="animate-fade-up rounded-[26px] border border-white/10 bg-card p-6"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-iris text-white">
                <f.icon size={20} strokeWidth={1.6} />
              </span>
              <h2 className="mt-4 font-serif text-[22px]">{f.title}</h2>
              <p className="mt-1.5 text-[14px] font-light leading-relaxed text-ash">{f.body}</p>
            </div>
          ))}
          <div
            className="animate-fade-up flex flex-col justify-between rounded-[26px] bg-iris p-6 text-white"
            style={{ animationDelay: `${FEATURES.length * 70}ms` }}
          >
            <p className="font-serif text-[26px] leading-snug">
              Free while it&apos;s yours. Your data stays on your machine.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm text-white transition-transform active:scale-95"
            >
              Create account <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-5 py-6 text-[13px] font-light text-fog sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} Moneta · Made by Amir Bagawan</p>
          <p className="font-mono text-[11px]">Money, quietly mastered.</p>
        </div>
      </footer>
    </div>
  );
}
