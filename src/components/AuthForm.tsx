"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowLeft, Eye, EyeOff, Sparkles } from "lucide-react";
import { Button, Field, Input, Segmented, Select } from "@/components/ui";
import { Logo } from "@/components/app/Logo";
import { CURRENCIES } from "@/lib/currency";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [persona, setPersona] = useState<"student" | "adult">("adult");
  const [currency, setCurrency] = useState("USD");
  const [sample, setSample] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"form" | "demo" | "google" | null>(null);
  const [demoPersona, setDemoPersona] = useState<"student" | "adult">("adult");

  // OAuth callback failures land here as ?error= — surface once, then clean up.
  // Mount-time read (repo convention): server prerenders without window, so
  // this must run after mount — otherwise server/client HTML differs (#418).
  const [oauthErr, setOauthErr] = useState("");
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("error");
      if (q) {
        window.history.replaceState(null, "", window.location.pathname);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time query read, see above
        setOauthErr(q);
      }
    } catch {}
  }, []);
  // Email-confirmation landing (?confirmed=1 from the inbox link).
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("confirmed");
      if (q) {
        window.history.replaceState(null, "", window.location.pathname);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time query read, see above
        setConfirmed(true);
      }
    } catch {}
  }, []);
  const shownErr = err || oauthErr;

  // DOM refs as fallback: browser autofill/password-managers can fill inputs
  // without firing React change events, leaving state empty.
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const val = (s: string, r: RefObject<HTMLInputElement | null>) => s || r.current?.value || "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy("form");
    const payloadName = val(name, nameRef).trim();
    const payloadEmail = val(email, emailRef).trim();
    const payloadPass = val(password, passRef);
    if (payloadName !== name) setName(payloadName);
    if (payloadEmail !== email) setEmail(payloadEmail);
    if (payloadPass !== password) setPassword(payloadPass);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { name: payloadName, email: payloadEmail, password: payloadPass, persona, currency, sample } : { email: payloadEmail, password: payloadPass }),
        signal: AbortSignal.timeout(25000),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; checkEmail?: boolean };
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      if (j.checkEmail) {
        setNotice("Account created — check your inbox for the confirmation link, then sign in.");
        setBusy(null);
        return;
      }
      router.replace(await nextRoute());
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  async function google() {
    setErr("");
    setNotice("");
    setBusy("google");
    try {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw new Error(error.message);
      // Redirects to Google — busy stays until navigation.
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Google sign-in failed");
      setBusy(null);
    }
  }

  async function nextRoute() {
    try {
      const r = await fetch("/api/bootstrap", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!r.ok) return "/app";
      const d = (await r.json()) as { user?: { onboardingComplete?: boolean } };
      return d.user && d.user.onboardingComplete === false ? "/onboarding" : "/app";
    } catch {
      return "/app";
    }
  }

  async function demo() {
    setErr("");
    setBusy("demo");
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: demoPersona, currency }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error("Couldn't start the demo");
      router.replace("/app");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't start the demo");
      setBusy(null);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-obsidian">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] animate-float rounded-full bg-deep-iris/60 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[420px] w-[420px] animate-float-slow rounded-full bg-[#1a4788]/60 blur-[120px]" />
      </div>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-6 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-ash transition-colors hover:text-white"><ArrowLeft size={16} /> <span className="text-sm">Back</span></Link>
          <Link href="/" className="flex items-center gap-2"><Logo size={26} /><span className="font-display text-[24px]">Moneta</span></Link>
        </div>

        <div className="animate-fade-up">
          <div className="label mb-3">{mode === "login" ? "Welcome back" : "Create your account"}</div>
          <h1 className="font-display text-[42px] leading-[1.02] sm:text-[52px]">
            {mode === "login" ? <>Pick up <em>where you left off.</em></> : <>Your money, <em>quietly mastered.</em></>}
          </h1>
        </div>

        <form onSubmit={submit} className="glass mt-8 animate-fade-up space-y-4 rounded-[28px] p-5 [animation-delay:120ms]">
          {mode === "signup" && (
            <>
              <Field label="Name"><Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required /></Field>
              <Field label="I am a"><Segmented value={persona} onChange={setPersona} options={[{ value: "student", label: "Student" }, { value: "adult", label: "Adult" }]} /></Field>
            </>
          )}
          <Field label="Email"><Input ref={emailRef} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" required /></Field>
          <Field label="Password">
            <div className="relative">
              <Input ref={passRef} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 6 characters" : "Your password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 6 : 1} className="pr-12" />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-ash hover:text-white">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </Field>
          {mode === "signup" && (
            <>
              <Field label="Currency">
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>)}
                </Select>
              </Field>
              <label className="flex cursor-pointer items-center gap-3 text-[14px] font-light text-ash">
                <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} className="h-4 w-4 accent-white" />
                Start with sample data so I can explore
              </label>
            </>
          )}
          {shownErr && <p role="alert" className="rounded-lg border border-[#ff7a7a]/30 bg-[#ff5d5d]/10 px-3 py-2 text-[13px] text-[#ff9a9a]">{shownErr}</p>}
          {notice && <p role="status" className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-[13px] text-white">{notice}</p>}
          {confirmed && !notice && <p role="status" className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-[13px] text-white">Email confirmed — sign in to continue.</p>}
          <Button type="submit" full size="lg" arrow disabled={busy !== null}>
            {busy === "form" ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
          <div className="flex items-center gap-3 text-[12px] text-fog">
            <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
          </div>
          <Button type="button" variant="ghost" full onClick={google} disabled={busy !== null}>
            {busy === "google" ? "Opening Google…" : "Continue with Google"}
          </Button>
          <p className="text-center text-[14px] font-light text-ash">
            {mode === "login" ? <>New here? <Link href="/signup" className="text-white underline underline-offset-4">Create an account</Link></> : <>Already have an account? <Link href="/login" className="text-white underline underline-offset-4">Sign in</Link></>}
          </p>
        </form>

        <div className="mt-6 animate-fade-up rounded-[28px] border border-white/10 p-5 [animation-delay:220ms]">
          <div className="mb-3 flex items-center gap-2 label"><Sparkles size={12} /> Just looking?</div>
          <p className="mb-4 text-[14px] font-light text-ash">Try a private demo pre-filled with three months of realistic activity — no sign-up.</p>
          <Segmented value={demoPersona} onChange={setDemoPersona} className="mb-3" options={[{ value: "adult", label: "Adult demo" }, { value: "student", label: "Student demo" }]} />
          {mode === "login" && (
            <div className="mb-3">
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Demo currency">
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>Demo in {c.code} ({c.symbol})</option>)}
              </Select>
            </div>
          )}
          <Button variant="ghost" full onClick={demo} disabled={busy !== null} arrow>{busy === "demo" ? "Preparing demo…" : "Explore the demo"}</Button>
          {mode === "login" && <p className="mt-3 text-center text-[12px] text-fog">Shared demo login: demo@moneta.app · demo1234</p>}
        </div>
        <p className="label mt-auto pt-10 text-center text-[10px] text-fog">Made by Amir Bagawan</p>
      </div>
    </div>
  );
}
