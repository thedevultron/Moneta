"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Field, Input, PageHeader, Segmented, Select } from "@/components/ui";
import { useApp } from "@/components/app/DataProvider";
import { BellToggle, CodeSlots, HoldButton, RubberSegment, SquishSwitch, TapSparks } from "@/components/micro";
import { CURRENCIES, getCurrency } from "@/lib/currency";
import { AI_PERSONALITIES } from "@/lib/personalities";
import { enableNotifications, isNotifyEnabled, notifyPermission, sendNotification, setNotifyEnabled } from "@/lib/notify";

export default function SettingsPage() {
  const { user, updateProfile, toast, confirm, refresh } = useApp();
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [income, setIncome] = useState(String(user.monthlyIncome || ""));
  const [currency, setCurrency] = useState(user.currency);
  const [convert, setConvert] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiP, setAiP] = useState(user.aiPersonality || "calm");
  const [think, setThink] = useState(user.thinkingLevel || "medium");
  const [newPin, setNewPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [notifyOn, setNotifyOn] = useState(false);
  const [perm, setPerm] = useState<string>("default");
  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<{ source: string; preview: string | null } | null>(null);
  const [keyMsg, setKeyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);

  // Sync local controls when the loaded profile changes (not render-derivable).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotifyOn(isNotifyEnabled(user.id));
    setPerm(notifyPermission());
    setAiP(user.aiPersonality || "calm");
    setThink(user.thinkingLevel || "medium");
  }, [user.id, user.aiPersonality, user.thinkingLevel]);

  useEffect(() => {
    fetch("/api/ai/key").then((r) => r.json()).then((j) => {
      if (j && !j.error) setKeyStatus({ source: j.source, preview: j.preview });
    }).catch(() => {});
  }, []);

  async function saveKey() {
    setKeyBusy(true);
    setKeyMsg(null);
    try {
      const r = await fetch("/api/ai/key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: apiKey }) });
      const j = (await r.json()) as { ok?: boolean; message?: string; error?: string };
      if (!r.ok) {
        setKeyMsg({ ok: false, text: j.error || "Key rejected" });
      } else {
        setKeyMsg({ ok: true, text: j.message || "Key works." });
        setApiKey("");
        const s = (await (await fetch("/api/ai/key")).json()) as { source: string; preview: string | null; error?: string };
        if (!s.error) setKeyStatus({ source: s.source, preview: s.preview });
      }
    } catch {
      setKeyMsg({ ok: false, text: "Couldn't reach the server." });
    } finally {
      setKeyBusy(false);
    }
  }

  async function removeKey() {
    await fetch("/api/ai/key", { method: "DELETE" });
    setKeyMsg({ ok: true, text: "In-app key removed — using .env key (if any)." });
    setKeyStatus({ source: "env", preview: null });
  }

  async function saveProfile() {
    setSaving(true);
    const inc = Number(income.replace(",", ".") || "0");
    const ok = await updateProfile({
      name: name.trim() || user.name,
      monthlyIncome: Number.isFinite(inc) ? inc : user.monthlyIncome,
      ...(currency !== user.currency ? { currency, convert } : {}),
    });
    setSaving(false);
    if (ok) toast("Settings saved");
  }

  async function post(url: string, method: string, msg: string) {
    const res = await fetch(url, { method });
    if (res.ok) {
      await refresh();
      toast(msg);
    } else toast("Something went wrong", "error");
  }

  async function savePin() {
    if (!/^\d{4}$/.test(newPin)) return;
    setPinBusy(true);
    const ok = await updateProfile({ pin: newPin });
    setPinBusy(false);
    if (ok) {
      setNewPin("");
      toast("PIN lock turned on");
    }
  }

  async function toggleNotify(on: boolean) {
    if (!on) {
      setNotifyEnabled(user.id, false);
      setNotifyOn(false);
      toast("Notifications off");
      return;
    }
    const ok = await enableNotifications(user.id);
    setPerm(notifyPermission());
    setNotifyOn(ok);
    if (ok) {
      sendNotification("Moneta notifications on", "I'll flag bills that are due soon.");
      toast("Notifications on");
    } else {
      toast("Permission blocked — allow notifications in the browser", "error");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <PageHeader eyebrow="Preferences" title="Settings" />

      <section className="card mb-5 space-y-5 p-6">
        <h2 className="font-display text-[28px]">Profile</h2>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <Field label="I am a">
          <Segmented value={user.persona} onChange={(v) => void updateProfile({ persona: v })} options={[{ value: "student", label: "Student" }, { value: "adult", label: "Adult" }]} />
        </Field>
        <Field label={`Monthly income (${getCurrency(currency).symbol})`} hint="Used for savings-rate and pace calculations.">
          <Input value={income} onChange={(e) => setIncome(e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="0" />
        </Field>
        <Field label="Currency">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>)}
          </Select>
        </Field>
        {currency !== user.currency && (
          <div className="flex items-start gap-4 rounded-xl border border-white/10 p-4">
            <div className="flex-1">
              <div className="text-[15px]">Convert existing amounts</div>
              <p className="mt-1 text-[13px] font-light text-ash">Approximate rates from {user.currency} to {currency}. Turn off to just change the symbol.</p>
            </div>
            <SquishSwitch on={convert} onChange={setConvert} label="Convert amounts" />
          </div>
        )}
        <TapSparks>
          <Button full size="lg" onClick={saveProfile} disabled={saving} arrow>{saving ? "Saving…" : "Save changes"}</Button>
        </TapSparks>
      </section>

      <section className="card mb-5 space-y-4 p-6">
        <h2 className="font-display text-[28px]">Coach vibe</h2>
        <RubberSegment
          value={aiP}
          onChange={async (v) => {
            setAiP(v);
            if (await updateProfile({ aiPersonality: v })) toast(`Coach is now ${AI_PERSONALITIES[v].label}`);
          }}
          options={Object.entries(AI_PERSONALITIES).map(([v, p]) => ({ value: v, label: p.label }))}
        />
        <p className="text-[14px] font-light text-ash">{AI_PERSONALITIES[aiP]?.tagline}</p>
        <div>
          <span className="label mb-2 block">Thinking level · chat + voice</span>
          <RubberSegment
            value={think}
            onChange={async (v) => {
              setThink(v);
              if (await updateProfile({ thinkingLevel: v })) toast(`Thinking: ${v}`);
            }}
            options={[{ value: "minimal", label: "Quick" }, { value: "low", label: "Low" }, { value: "medium", label: "Deep" }, { value: "high", label: "Max" }]}
          />
          <p className="mt-2 text-[13px] font-light text-ash">Quick answers fastest and cheapest. Max thinks hardest — slower, sharper, uses more quota.</p>
        </div>
      </section>

      <section className="card mb-5 space-y-4 p-6">
        <h2 className="font-display text-[28px]">AI key</h2>
        <p className="text-[14px] font-light text-ash">
          {keyStatus?.preview
            ? `Active key ends ${keyStatus.preview} (${keyStatus.source === "app" ? "saved in app" : "from .env"}). Paste a new one anytime to replace it.`
            : "No working key yet — Coach runs in local mode. Paste your AI Studio key and hit Save; it's tested with Google before anything is stored."}
        </p>
        <Field label="Google AI Studio key">
          <Input type="password" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setKeyMsg(null); }} placeholder="Paste full key here" autoComplete="off" />
        </Field>
        {keyMsg && <p role={keyMsg.ok ? "status" : "alert"} className={`text-[13px] ${keyMsg.ok ? "text-sage" : "text-[#ff9a9a]"}`}>{keyMsg.text}</p>}
        <div className="flex flex-wrap gap-2.5">
          <Button variant="subtle" disabled={keyBusy || !apiKey.trim()} onClick={saveKey}>{keyBusy ? "Testing with Google…" : "Save & test key"}</Button>
          {keyStatus?.source === "app" && <Button variant="ghost" onClick={removeKey}>Remove in-app key</Button>}
        </div>
      </section>

      <section className="card mb-5 space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[28px]">Notifications</h2>
          <BellToggle on={notifyOn} onChange={toggleNotify} />
        </div>
        <p className="text-[14px] font-light text-ash">
          {notifyOn
            ? "On — Moneta flags bills due in the next 3 days, once a day."
            : perm === "denied"
              ? "Blocked — allow notifications in your browser settings, then tap the bell."
              : "Off — tap the bell to get bill reminders."}
        </p>
        {notifyOn && (
          <Button variant="subtle" onClick={() => sendNotification("Moneta test", "This is how bill reminders look.")}>Send test notification</Button>
        )}
      </section>

      <section className="card mb-5 space-y-4 p-6">
        <h2 className="font-display text-[28px]">PIN lock</h2>
        {user.hasPin ? (
          <p className="text-[14px] font-light text-ash">A 4-digit PIN guards the app on this device. You can change it below or enter a new one to replace it.</p>
        ) : (
          <p className="text-[14px] font-light text-ash">Add a 4-digit PIN so nobody opening the app on this device sees your money.</p>
        )}
        <CodeSlots length={4} value={newPin} onChange={setNewPin} />
        <div className="flex flex-wrap gap-2.5">
          <Button variant="subtle" disabled={pinBusy || !/^\d{4}$/.test(newPin)} onClick={savePin}>
            {pinBusy ? "Saving…" : user.hasPin ? "Change PIN" : "Set PIN"}
          </Button>
          {user.hasPin && (
            <Button variant="ghost" onClick={() => void updateProfile({ clearPin: true }).then((ok) => ok && toast("PIN lock removed"))}>
              Remove PIN
            </Button>
          )}
        </div>
      </section>

      <section className="card mb-5 space-y-3 p-6">
        <h2 className="font-display text-[28px]">Data</h2>
        <p className="text-[14px] font-light text-ash">Explore with realistic sample data, or start from a clean slate. Destructive actions need a press-and-hold.</p>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="subtle" onClick={() => confirm({ title: "Load sample data?", body: "This replaces your current transactions, budgets, goals and recurring bills with demo data.", confirmLabel: "Load sample", onConfirm: () => post("/api/sample", "POST", "Sample data loaded") })}>Load sample data</Button>
        </div>
        <HoldButton tone="danger" onHold={() => confirm({ title: "Clear all data?", body: "All transactions, budgets, goals and recurring bills will be permanently deleted.", confirmLabel: "Clear everything", danger: true, onConfirm: () => post("/api/sample", "DELETE", "All data cleared") })}>
          Hold to clear all data
        </HoldButton>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-[28px]">Account</h2>
        <p className="text-[14px] font-light text-ash">{user.email}</p>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="ghost" onClick={logout}>Sign out</Button>
        </div>
        <HoldButton
          tone="danger"
          onHold={() => confirm({ title: "Are you sure?", body: "Do you really want to delete your account? Your account and all of its data will be permanently removed and this can't be undone.", confirmLabel: "Yes, delete forever", danger: true, onConfirm: async () => { await fetch("/api/profile", { method: "DELETE" }); router.replace("/"); } })}
        >
          Hold to delete account
        </HoldButton>
      </section>

      <p className="label mt-10 text-center text-[10px] text-fog">Moneta · Made by Amir Bagawan</p>
    </div>
  );
}
