"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button, Field, Input } from "@/components/ui";
import { useApp } from "@/components/app/DataProvider";
import { Logo } from "@/components/app/Logo";
import { CodeSlots } from "@/components/micro";

/** App PIN gate: wraps protected content, asks for the PIN once per tab. */
export function PinLock({ children }: { children: ReactNode }) {
  const { user, refresh } = useApp();
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(`moneta_pin_ok_${user.id}`) === "1";
    } catch {
      return false;
    }
  });
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [password, setPassword] = useState("");

  if (!user.hasPin || unlocked) return <>{children}</>;

  async function verify(v: string) {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/pin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: v }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Wrong PIN");
      try {
        sessionStorage.setItem(`moneta_pin_ok_${user.id}`, "1");
      } catch {}
      setUnlocked(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Wrong PIN");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  async function resetWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/pin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Couldn't reset PIN");
      try {
        sessionStorage.setItem(`moneta_pin_ok_${user.id}`, "1");
      } catch {}
      await refresh();
      setUnlocked(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't reset PIN");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center py-10 text-center">
      <Logo size={44} />
      <div className="label mb-3 mt-6">Moneta is locked</div>
      <h1 className="font-display text-[34px] leading-tight sm:text-[40px]">
        Hey {user.name.split(" ")[0]},<br />
        <em>enter your PIN.</em>
      </h1>
      {!forgot ? (
        <div className="mt-8 w-full max-w-[280px]">
          <CodeSlots length={4} value={pin} error={err} autoFocus onChange={setPin} onComplete={(v) => void verify(v)} />
          {busy && <p className="label mt-4 text-[10px]">Checking…</p>}
          <button onClick={() => setForgot(true)} className="mt-6 text-[14px] font-light text-ash underline underline-offset-4 hover:text-white">
            Forgot PIN?
          </button>
        </div>
      ) : (
        <form onSubmit={resetWithPassword} className="glass mt-8 w-full max-w-[320px] space-y-4 rounded-[28px] p-5 text-left">
          <p className="text-[14px] font-light text-ash">Enter your account password to remove the PIN lock.</p>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          {err && <p role="alert" className="text-[13px] text-[#ff9a9a]">{err}</p>}
          <Button type="submit" full disabled={busy || !password}>{busy ? "Checking…" : "Remove PIN lock"}</Button>
          <button type="button" onClick={() => { setForgot(false); setErr(""); }} className="w-full py-1 text-center text-[14px] text-ash hover:text-white">
            Back to PIN
          </button>
        </form>
      )}
      <button onClick={logout} className="mt-8 text-[13px] font-light text-fog hover:text-white">
        Sign out
      </button>
    </div>
  );
}
