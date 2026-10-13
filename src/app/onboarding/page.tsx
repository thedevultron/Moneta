"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { Logo } from "@/components/app/Logo";
import { CodeSlots, CometDial, RubberSegment, SquishSwitch, TapSparks } from "@/components/micro";
import { CURRENCIES } from "@/lib/currency";
import { AI_PERSONALITIES } from "@/lib/personalities";
import type { AppData } from "@/lib/types";

const STEPS = ["Name", "You", "Coach", "PIN", "Money", "Ready"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [data, setData] = useState<AppData | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [name, setName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const [persona, setPersona] = useState<"student" | "adult">("adult");
  const [aiP, setAiP] = useState("calm");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [income, setIncome] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [sample, setSample] = useState(false);

  useEffect(() => {
    fetch("/api/bootstrap", { cache: "no-store" }).then(async (r) => {
      if (r.status === 401) {
        router.replace("/login");
        return;
      }
      const d = (await r.json()) as AppData;
      if (d.user.onboardingComplete) {
        router.replace("/app");
        return;
      }
      setData(d);
      setName(d.user.name || "");
      setPersona(d.user.persona);
      setAiP(d.user.aiPersonality || "calm");
      setCurrency(d.user.currency);
      if (d.user.monthlyIncome) setIncome(String(d.user.monthlyIncome));
    }).catch(() => router.replace("/login"));
  }, [router]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error || "Couldn't save");
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function next(body?: Record<string, unknown>) {
    if (body && !(await patch(body))) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0 });
  }

  async function finish() {
    if (!(await patch({ onboardingComplete: true }))) return;
    router.replace("/app");
    router.refresh();
  }

  if (!data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-obsidian">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 rounded-full bg-white" style={{ animation: "dots 1.2s infinite", animationDelay: `${d * 0.15}s` }} />)}
        </div>
      </div>
    );
  }

  const pinDone = pin.length === 4 && pin === pin2;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-obsidian">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] animate-float rounded-full bg-deep-iris/60 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[420px] w-[420px] animate-float-slow rounded-full bg-iris/50 blur-[120px]" />
      </div>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-6 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="mb-6 flex items-center justify-between">
          {step > 0 && step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-2 text-ash transition-colors hover:text-white" aria-label="Back">
              <ArrowLeft size={16} /> <span className="text-sm">Back</span>
            </button>
          ) : <span />}
          <span className="flex items-center gap-2"><Logo size={24} /><span className="font-display text-[22px]">Moneta</span></span>
        </div>

        <div className="mb-8 flex gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={false}
                animate={{ scaleX: i < step ? 1 : i === step ? 0.45 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="h-full w-full origin-left rounded-full bg-white"
              />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -32 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            {step === 0 && (
              <div>
                <div className="label mb-3">Step 1 of {STEPS.length - 1} · Your name</div>
                <h1 className="font-display text-[38px] leading-[1.02] sm:text-[46px]">What should we <em>call you?</em></h1>
                <div className="glass mt-8 space-y-4 rounded-[28px] p-5">
                  <Field label="First name">
                    <Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60} autoFocus />
                  </Field>
                  {err && <p role="alert" className="text-[13px] text-[#ff9a9a]">{err}</p>}
                  <TapSparks>
                    <Button full size="lg" arrow disabled={busy} onClick={() => {
                      // Fall back to the DOM value (browser autofill can bypass React state)
                      const v = (name.trim() || nameRef.current?.value?.trim() || "");
                      if (!v) {
                        nameRef.current?.focus();
                        return;
                      }
                      if (v !== name) setName(v);
                      void next({ name: v });
                    }}>
                      Continue
                    </Button>
                  </TapSparks>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="label mb-3">Step 2 of {STEPS.length - 1} · About you</div>
                <h1 className="font-display text-[38px] leading-[1.02] sm:text-[46px]">Which one is <em>you?</em></h1>
                <div className="glass mt-8 space-y-4 rounded-[28px] p-5">
                  <div>
                    <span className="label mb-2 block">I am a</span>
                    <RubberSegment value={persona} onChange={setPersona} options={[{ value: "student", label: "Student" }, { value: "adult", label: "Adult" }]} />
                  </div>
                  <p className="text-[14px] font-light leading-relaxed text-ash">
                    {persona === "student" ? "Campus budgets, allowances and small wins — Coach tunes every tip for student life." : "Salaries, bills and bigger goals — Coach tunes every tip for adult life."}
                  </p>
                  {err && <p role="alert" className="text-[13px] text-[#ff9a9a]">{err}</p>}
                  <TapSparks>
                    <Button full size="lg" arrow disabled={busy} onClick={() => next({ persona })}>Continue</Button>
                  </TapSparks>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="label mb-3">Step 3 of {STEPS.length - 1} · Your coach</div>
                <h1 className="font-display text-[38px] leading-[1.02] sm:text-[46px]">Pick your <em>coach vibe</em></h1>
                <p className="mt-3 flex items-center gap-2 text-[14px] font-light text-ash"><Sparkles size={14} /> Tap a satellite to preview the personality.</p>
                <div className="glass mt-6 rounded-[28px] p-5">
                  <CometDial
                    value={aiP}
                    onChange={setAiP}
                    options={Object.entries(AI_PERSONALITIES).map(([v, p]) => ({ value: v, label: p.label, sub: p.tagline }))}
                  />
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4 text-[14px] font-light leading-relaxed text-silver">
                    {aiP === "calm" && "“Groceries are up a little this month. Nothing to worry about — here's one gentle tweak that saves about $40.”"}
                    {aiP === "hype" && "“Dining tried to sneak up on you — NOT TODAY. Cut one takeaway a week and that's $120 back in your pocket!”"}
                    {aiP === "strict" && "“Dining is 34% over budget. No more takeaways until Friday. That's the rule. You'll thank me.”"}
                    {aiP === "playful" && "“Your coffee habit is brewing up a storm — $96 a month! Let's depresso that espresso bill.”"}
                  </div>
                  {err && <p role="alert" className="mt-3 text-[13px] text-[#ff9a9a]">{err}</p>}
                  <TapSparks className="mt-4">
                    <Button full size="lg" arrow disabled={busy} onClick={() => next({ aiPersonality: aiP })}>Coach {AI_PERSONALITIES[aiP].label} it is</Button>
                  </TapSparks>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="label mb-3">Step 4 of {STEPS.length - 1} · App PIN</div>
                <h1 className="font-display text-[38px] leading-[1.02] sm:text-[46px]">Lock it with a <em>PIN?</em></h1>
                <div className="glass mt-8 space-y-5 rounded-[28px] p-5">
                  <CodeSlots length={4} value={pin} onChange={(v) => { setPin(v); setPinErr(""); }} autoFocus />
                  {pin.length === 4 && (
                    <div className="animate-fade-up">
                      <div className="label mb-3 text-center">Repeat it to confirm</div>
                      <CodeSlots
                        length={4}
                        value={pin2}
                        error={pinErr}
                        onChange={(v) => {
                          setPin2(v);
                          setPinErr("");
                          if (v.length === 4 && v !== pin) setPinErr("PINs don't match — try again");
                        }}
                      />
                    </div>
                  )}
                  {err && <p role="alert" className="text-center text-[13px] text-[#ff9a9a]">{err}</p>}
                  <TapSparks>
                    <Button full size="lg" arrow disabled={busy || !pinDone} onClick={() => next({ pin })}>Set PIN</Button>
                  </TapSparks>
                  <button onClick={() => next()} disabled={busy} className="w-full py-2 text-center text-[14px] font-light text-ash transition-colors hover:text-white">
                    Skip — no PIN for now
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <div className="label mb-3">Step 5 of {STEPS.length - 1} · Your numbers</div>
                <h1 className="font-display text-[38px] leading-[1.02] sm:text-[46px]">Almost <em>there.</em></h1>
                <div className="glass mt-8 space-y-4 rounded-[28px] p-5">
                  <Field label="Monthly income" hint="Used for savings-rate and pace calculations.">
                    <Input value={income} onChange={(e) => setIncome(e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="0" />
                  </Field>
                  <Field label="Currency">
                    <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>)}
                    </Select>
                  </Field>
                  <div className="flex items-start gap-4 rounded-xl border border-white/10 p-4">
                    <div className="flex-1">
                      <div className="text-[15px]">Start with sample data</div>
                      <p className="mt-1 text-[13px] font-light text-ash">Three months of realistic activity so every chart works instantly. You can clear it in Settings.</p>
                    </div>
                    <SquishSwitch on={sample} onChange={setSample} label="Sample data" />
                  </div>
                  {err && <p role="alert" className="text-[13px] text-[#ff9a9a]">{err}</p>}
                  <TapSparks>
                    <Button
                      full size="lg" arrow disabled={busy}
                      onClick={async () => {
                        const inc = Number(income.replace(",", ".") || "0");
                        const ok = await patch({ monthlyIncome: Number.isFinite(inc) ? inc : 0, currency });
                        if (!ok) return;
                        if (sample) {
                          setBusy(true);
                          await fetch("/api/sample", { method: "POST" });
                          setBusy(false);
                        }
                        setStep(5);
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      Finish setup
                    </Button>
                  </TapSparks>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="py-8 text-center">
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16 }}
                  className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white text-black"
                >
                  <Check size={34} />
                </motion.div>
                <h1 className="font-display mt-6 text-[42px] leading-[1.02] sm:text-[52px]">You&apos;re <em>ready.</em></h1>
                <p className="mx-auto mt-3 max-w-[300px] text-[15px] font-light text-ash">
                  {name.split(" ")[0] || "Friend"}, your Coach {AI_PERSONALITIES[aiP].label.toLowerCase()} is warmed up and your dashboard is waiting.
                </p>
                <TapSparks className="mt-8">
                  <Button full size="lg" arrow disabled={busy} onClick={finish}>
                    {busy ? "Opening…" : "Enter dashboard"}
                  </Button>
                </TapSparks>
                <Link href="/app/ai" className="mt-4 inline-block text-[14px] font-light text-ash underline underline-offset-4 hover:text-white">
                  Or say hi to your coach first
                </Link>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <p className="label mt-auto pt-10 text-center text-[10px] text-fog">Moneta · Made by Amir Bagawan</p>
      </div>
    </div>
  );
}
