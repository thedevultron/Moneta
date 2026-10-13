"use client";

import { ArrowRight, X } from "lucide-react";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes } from "react";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "subtle" | "danger";
  size?: "sm" | "md" | "lg";
  arrow?: boolean;
  full?: boolean;
};
export function Button({ variant = "primary", size = "md", arrow, full, className, children, ...p }: BtnProps) {
  const v = {
    primary: "bg-white text-black hover:bg-[#e9e9ec] active:scale-[0.98]",
    ghost: "border border-white/20 text-white hover:bg-white/10 active:scale-[0.98]",
    subtle: "bg-white/[0.07] text-cloud hover:bg-white/[0.12] active:scale-[0.98]",
    danger: "bg-[#ff5d5d]/10 text-[#ff8a8a] hover:bg-[#ff5d5d]/20 active:scale-[0.98]",
  }[variant];
  const s = { sm: "h-9 px-3.5 text-[13px]", md: "h-11 px-[18px] text-[15px]", lg: "h-[52px] px-6 text-base" }[size];
  return (
    <button
      {...p}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-lg font-normal transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40",
        v, s, full && "w-full", className,
      )}
    >
      {children}
      {arrow && <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />}
    </button>
  );
}

export function Input({ className, ref, ...p }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      {...p}
      className={cn(
        "h-12 w-full rounded-lg border border-white/10 bg-black px-4 text-[15px] text-cloud outline-none transition-colors placeholder:text-fog focus:border-white/40",
        className,
      )}
    />
  );
}

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      className={cn(
        "h-12 w-full appearance-none rounded-lg border border-white/10 bg-black px-4 text-[15px] text-cloud outline-none transition-colors focus:border-white/40",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-2 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-fog">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, className,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={cn("flex rounded-lg bg-white/[0.06] p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 flex-1 rounded-md text-[13px] transition-all duration-200",
            value === o.value ? "bg-white text-black" : "text-ash hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200", on ? "bg-white" : "bg-white/15")}
    >
      <span className={cn("absolute top-1 h-5 w-5 rounded-full transition-all duration-200", on ? "left-6 bg-black" : "left-1 bg-white")} />
    </button>
  );
}

export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; tall?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center">
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex w-full max-w-[480px] animate-sheet-up flex-col rounded-t-[30px] border border-white/10 bg-[#141516] md:rounded-[30px] md:animate-pop",
          tall ? "max-h-[94dvh]" : "max-h-[90dvh]",
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20 md:hidden" />
        <div className="flex items-center justify-between px-6 pb-2 pt-4">
          <h2 className="font-display text-[28px]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.07] text-ash transition-colors hover:text-white">
            <X size={17} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="card flex animate-fade-up flex-col items-center px-8 py-14 text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-ash">{icon}</div>
      <h3 className="font-display text-[30px]">{title}</h3>
      <p className="mt-2 max-w-[300px] text-[15px] font-light text-ash">{body}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2.5">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function ProgressBar({ value, color = "#fff", over }: { value: number; color?: string; over?: boolean }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%`, background: over ? "#ff7a7a" : color }}
      />
    </div>
  );
}

export function PageHeader({ eyebrow, title, right }: { eyebrow?: string; title: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4 pt-2">
      <div className="min-w-0">
        {eyebrow && <div className="label mb-2">{eyebrow}</div>}
        <h1 className="font-display text-[40px] sm:text-[48px]">{title}</h1>
      </div>
      {right && <div className="shrink-0 pb-1">{right}</div>}
    </header>
  );
}

export function AnimatedNumber({ value, format, className, fromZero }: { value: number; format: (v: number) => string; className?: string; fromZero?: boolean }) {
  const [shown, setShown] = useState(fromZero ? 0 : value);
  const from = useRef(fromZero ? 0 : value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      const v = a + (value - a) * e;
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={cn("tabular", className)}>{format(shown)}</span>;
}
