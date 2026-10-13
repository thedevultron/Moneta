"use client";

/**
 * Moneta micro-interactions — tap-first, spring-physics controls for mobile.
 * (ReactBits ships no such parts and hover doesn't exist on phones, so these
 * are hand-built in the app's visual language: TapSparks, CodeSlots,
 * HoldButton, RubberSegment, SquishSwitch, SpringCheck, BellToggle,
 * Shredder, VoicePill, CometDial.)
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, BellRing, Check, Mic } from "lucide-react";
import { cn } from "@/components/ui";

/* ---------------- TapSparks (ReactBits ClickSpark, adapted) ---------------- */

export function TapSparks({
  children, color = "#fff", count = 8, className,
}: { children: ReactNode; color?: string; count?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparks = useRef<{ x: number; y: number; angle: number; t: number }[]>([]);
  const DUR = 420;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparks.current = sparks.current.filter((s) => {
        const p = (now - s.t) / DUR;
        if (p >= 1) return false;
        const e = p * (2 - p);
        const d = e * 26;
        const len = 9 * (1 - e);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x + d * Math.cos(s.angle), s.y + d * Math.sin(s.angle));
        ctx.lineTo(s.x + (d + len) * Math.cos(s.angle), s.y + (d + len) * Math.sin(s.angle));
        ctx.stroke();
        return true;
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const fit = () => {
      const r = parent.getBoundingClientRect();
      canvas.width = Math.max(1, r.width);
      canvas.height = Math.max(1, r.height);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={cn("relative", className)}
      onPointerDown={(e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        const now = performance.now();
        for (let i = 0; i < count; i++) {
          sparks.current.push({ x, y, angle: (2 * Math.PI * i) / count, t: now });
        }
      }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {children}
    </div>
  );
}

/* ---------------- CodeSlots (PIN entry) ---------------- */

export function CodeSlots({
  length = 4, value, onChange, onComplete, autoFocus, error,
}: { length?: number; value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; autoFocus?: boolean; error?: string }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => refs.current[Math.min(value.length, length - 1)]?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [autoFocus, length, value.length]);

  const set = useCallback((v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  }, [length, onChange, onComplete]);

  return (
    <div>
      <div className="flex justify-center gap-3" role="group" aria-label="PIN entry">
        {digits.map((d, i) => (
          <motion.input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={d}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={`Digit ${i + 1}`}
            maxLength={i === 0 ? length : 1}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              if (i === 0 && raw.length > 1) {
                set(raw); // pasted full PIN into first slot
                refs.current[length - 1]?.focus();
                return;
              }
              if (!raw) {
                set(value.slice(0, i));
                return;
              }
              const next = (value.slice(0, i) + raw.slice(-1) + value.slice(i + 1)).slice(0, length);
              set(next);
              if (i < length - 1) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) {
                refs.current[i - 1]?.focus();
                set(value.slice(0, i - 1));
              }
            }}
            onFocus={(e) => e.target.select()}
            initial={false}
            animate={error ? { x: [0, -9, 9, -6, 6, 0] } : { scale: d ? [1.25, 1] : 1 }}
            transition={{ duration: error ? 0.4 : 0.22 }}
            className={cn(
              "font-display tabular h-16 w-[52px] rounded-2xl border text-center text-[30px] text-cloud outline-none transition-colors",
              error ? "border-[#ff7a7a]/60 bg-[#ff5d5d]/10" : d ? "border-white/50 bg-white/[0.08]" : "border-white/12 bg-black",
              "focus:border-white/60",
            )}
          />
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-center text-[13px] text-[#ff9a9a]">{error}</p>}
    </div>
  );
}

/* ---------------- HoldButton (press-and-hold confirm) ---------------- */

export function HoldButton({
  children, onHold, holdMs = 1100, tone = "danger", className, disabled, compact, full = true,
}: { children: ReactNode; onHold: () => void; holdMs?: number; tone?: "danger" | "primary"; className?: string; disabled?: boolean; compact?: boolean; full?: boolean }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const start = useRef(0);

  const cancel = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setP(0);
  }, []);

  const begin = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    start.current = performance.now();
    const tick = (now: number) => {
      const v = Math.min(1, (now - start.current) / holdMs);
      setP(v);
      if (v >= 1) {
        try { navigator.vibrate?.(15); } catch {}
        onHold();
        setP(0);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [disabled, holdMs, onHold]);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "relative h-[52px] touch-none select-none overflow-hidden rounded-lg text-base transition-opacity disabled:opacity-40",
        tone === "danger" ? "bg-[#ff5d5d]/10 text-[#ff8a8a]" : "bg-white text-black",
        full && "w-full",
        compact && "text-[13px]",
        className,
      )}
    >
      <span className={cn("absolute inset-y-0 left-0", tone === "danger" ? "bg-[#ff5d5d]/25" : "bg-black/10")} style={{ width: `${p * 100}%` }} />
      <span className="relative flex items-center justify-center gap-2">
        {p > 0 ? (compact ? `${Math.round(p * 100)}%` : `Hold… ${Math.round(p * 100)}%`) : children}
      </span>
    </button>
  );
}

/* ---------------- RubberSegment ---------------- */

export function RubberSegment<T extends string>({
  value, onChange, options, className,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={cn("relative flex rounded-xl bg-white/[0.06] p-1", className)} role="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn("relative h-10 flex-1 rounded-lg text-[13px] transition-colors duration-200", on ? "text-black" : "text-ash")}
          >
            {on && (
              <motion.span
                layoutId={`rubber-${id}`}
                transition={{ type: "spring", stiffness: 550, damping: 36 }}
                className="absolute inset-0 rounded-lg bg-white"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- SquishSwitch ---------------- */

export function SquishSwitch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => {
        try { navigator.vibrate?.(5); } catch {}
        onChange(!on);
      }}
      className={cn("relative h-8 w-[54px] shrink-0 rounded-full transition-colors duration-200", on ? "bg-white" : "bg-white/15")}
    >
      <motion.span
        key={String(on)}
        initial={{ scaleX: 1.45, scaleY: 0.7 }}
        animate={{ scaleX: 1, scaleY: 1, x: on ? 24 : 0 }}
        transition={{ type: "spring", stiffness: 600, damping: 22 }}
        className={cn("absolute left-1 top-1 block h-6 w-6 rounded-full", on ? "bg-black" : "bg-white")}
      />
    </button>
  );
}

/* ---------------- SpringCheck ---------------- */

export function SpringCheck({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="grid h-7 w-7 shrink-0 place-items-center"
    >
      <motion.span
        key={String(on)}
        initial={{ scale: 0.55 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 700, damping: 20 }}
        className={cn("grid h-6 w-6 place-items-center rounded-lg border transition-colors", on ? "border-white bg-white text-black" : "border-white/25 bg-transparent text-transparent")}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <motion.path
            d="M2.5 7.5 6 11 11.5 3.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: on ? 1 : 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          />
        </svg>
      </motion.span>
    </button>
  );
}

/* ---------------- BellToggle ---------------- */

export function BellToggle({ on, onChange, label = "Notifications" }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => {
        try { navigator.vibrate?.(8); } catch {}
        onChange(!on);
      }}
      className={cn(
        "relative grid h-12 w-12 place-items-center rounded-full border transition-colors duration-200 active:scale-90",
        on ? "border-white bg-white text-black" : "border-white/15 bg-white/[0.06] text-ash",
      )}
    >
      <motion.span
        key={String(on)}
        initial={false}
        animate={on ? { rotate: [0, -22, 16, -9, 0] } : { rotate: 0 }}
        transition={{ duration: 0.55, ease: "easeInOut" }}
        className="grid place-items-center"
      >
        {on ? <BellRing size={20} /> : <Bell size={20} />}
      </motion.span>
      {on && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#0f1011]"><span className="absolute inset-0 animate-ping rounded-full bg-[#0f1011]/60" /></span>}
    </button>
  );
}

/* ---------------- Shredder ---------------- */

export function Shredder({
  shredding, onDone, children, strips = 7, className,
}: { shredding: boolean; onDone: () => void; children: ReactNode; strips?: number; className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!shredding) {
      setShow(false);
      return;
    }
    setShow(true);
    const t = setTimeout(onDone, 700);
    return () => clearTimeout(t);
  }, [shredding, onDone]);

  if (!show) return <div className={className}>{children}</div>;
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="invisible">{children}</div>
      <div className="absolute inset-0 flex" aria-hidden>
        {Array.from({ length: strips }, (_, i) => (
          <div key={i} className="relative h-full overflow-hidden" style={{ width: `${100 / strips}%` }}>
            <motion.div
              initial={{ y: 0, opacity: 1, rotate: 0 }}
              animate={{ y: [0, 26 + (i % 3) * 14, 120], opacity: [1, 1, 0], rotate: (i % 2 === 0 ? 1 : -1) * (4 + i) }}
              transition={{ duration: 0.65, ease: "easeIn", delay: i * 0.02 }}
              className="absolute inset-y-0"
              style={{ width: `${strips * 100}%`, left: `-${i * 100}%` }}
            >
              <div className="pointer-events-none" style={{ width: "100%" }}>{children}</div>
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- VoicePill ---------------- */

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export function VoicePill({
  state, onTap, disabled, label,
}: { state: VoiceState; onTap: () => void; disabled?: boolean; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <motion.button
        type="button"
        onClick={onTap}
        disabled={disabled}
        aria-label={label ?? (state === "idle" ? "Start talking" : "Stop")}
        whileTap={{ scale: 0.9 }}
        animate={state === "listening" ? { scale: [1, 1.07, 1] } : { scale: 1 }}
        transition={state === "listening" ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        className={cn(
          "relative grid h-20 w-20 place-items-center rounded-full border transition-colors duration-300 disabled:opacity-40",
          state === "idle" ? "border-white/20 bg-white/[0.07] text-white" : "border-white bg-white text-black",
        )}
      >
        {state === "listening" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-white/25" style={{ animationDuration: "1.6s" }} />
        )}
        {state === "idle" && <Mic size={28} strokeWidth={1.6} />}
        {state === "listening" && <ListeningBars dark />}
        {state === "thinking" && (
          <span className="flex gap-1.5">
            {[0, 1, 2].map((d) => (
              <span key={d} className="h-2 w-2 rounded-full bg-black" style={{ animation: "dots 1.1s infinite", animationDelay: `${d * 0.15}s` }} />
            ))}
          </span>
        )}
        {state === "speaking" && <ListeningBars dark live />}
      </motion.button>
      <AnimatePresence mode="wait">
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="label text-[10px]"
        >
          {state === "idle" && "Tap to talk"}
          {state === "listening" && "Listening… tap to send"}
          {state === "thinking" && "Coach is thinking…"}
          {state === "speaking" && "Speaking… tap to stop"}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export function ListeningBars({ dark, live }: { dark?: boolean; live?: boolean }) {
  const c = dark ? "bg-black" : "bg-white";
  return (
    <span className="flex h-7 items-center gap-[3px]" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          className={cn("w-[3px] rounded-full", c)}
          animate={{ height: [8, 10 + ((i * 7) % 16), 6 + ((i * 5) % 12), 12] }}
          transition={{ duration: live ? 0.5 : 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.09 }}
        />
      ))}
    </span>
  );
}

/* ---------------- CometDial (radial tap picker) ---------------- */

export function CometDial<T extends string>({
  options, value, onChange, size = 248,
}: { options: { value: T; label: string; sub?: string }[]; value: T; onChange: (v: T) => void; size?: number }) {
  const n = options.length;
  const sel = options.find((o) => o.value === value) ?? options[0];
  const R = size / 2 - 34;
  const C = size / 2;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} role="radiogroup" aria-label="Choose">
      <div className="pointer-events-none absolute inset-[26px] rounded-full border border-white/10" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-[26px]"
        animate={{ rotate: 360 }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
      >
        <span className="absolute -top-[3px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_4px_rgba(255,255,255,0.45)]" />
      </motion.div>
      {options.map((o, i) => {
        const a = (-90 + (i * 360) / n) * (Math.PI / 180);
        const x = C + R * Math.cos(a);
        const y = C + R * Math.sin(a);
        const on = o.value === value;
        return (
          <motion.button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            initial={false}
            animate={{ scale: on ? 1.12 : 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 24 }}
            className={cn(
              "absolute grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border font-display text-[22px] transition-colors active:scale-95",
              on ? "border-white bg-white text-black" : "border-white/20 bg-[#1a1b1e] text-cloud",
            )}
            style={{ left: x, top: y }}
          >
            {o.label.slice(0, 1)}
          </motion.button>
        );
      })}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="max-w-[118px] text-center">
          <AnimatePresence mode="wait">
            <motion.div key={sel.value} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <div className="font-display text-[26px] leading-none">{sel.label}</div>
              {sel.sub && <div className="mt-1.5 text-[11px] font-light leading-snug text-ash">{sel.sub}</div>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
