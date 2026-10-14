"use client";

/**
 * Moneta stat charts — hand-built SVG (tap-to-select, side legends with
 * markers). No hover anywhere: on phones the detail lives beside the chart
 * and updates on tap.
 */
import { useId, useState } from "react";
import { cn } from "@/components/ui";

/* ---------- shared side legend (info on the side, with markers) ---------- */

export type LegendItem = { id: string; label: string; value: string; sub?: string; color: string };

export function SideLegend({
  items, selected, onSelect, total,
}: { items: LegendItem[]; selected?: string | null; onSelect?: (id: string) => void; total?: string }) {
  const sum = items.length;
  return (
    <div>
      <ul className="space-y-1">
        {items.map((it) => {
          const on = selected === it.id;
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => onSelect?.(it.id)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all duration-200 active:scale-[0.99]",
                  on ? "bg-white/[0.08]" : "bg-transparent",
                )}
              >
                <i className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: it.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-cloud">{it.label}</span>
                  {it.sub && <span className="block truncate text-[12px] font-light text-ash">{it.sub}</span>}
                </span>
                <span className="tabular shrink-0 text-[14px] text-cloud">{it.value}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {total !== undefined && (
        <div className="mt-2 flex items-center justify-between border-t border-white/10 px-2.5 pt-2.5">
          <span className="label text-[10px]">{sum} items</span>
          <span className="tabular text-[15px] text-cloud">{total}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- geometry helpers ---------- */

const W = 320;
const H = 150;
const PAD = 8;
const PAD_L = 38;

function scale(values: number[][], h: number) {
  const max = Math.max(1, ...values.flat());
  return (v: number) => h - PAD - (v / max) * (h - PAD * 2 - 6);
}

function fmtTick(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${Math.round(v)}`;
}

function AxisGrid({ max, y }: { max: number; y: (v: number) => number }) {
  return (
    <g>
      {[0, max / 2, max].map((t) => (
        <g key={t}>
          <line x1={PAD_L} x2={W - PAD} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.16)" strokeWidth="1" strokeDasharray="2 4" />
          <text x={2} y={y(t) + 3} fontSize={8} fill="rgba(255,255,255,0.45)" fontFamily="monospace">{fmtTick(t)}</text>
        </g>
      ))}
      <line x1={PAD_L} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
    </g>
  );
}

/* ---------- line / area / bar trend (tap a month) ---------- */

export function TrendChart({
  expense, income, labels, selected, onSelect, kind,
}: { expense: number[]; income: number[]; labels: string[]; selected: number; onSelect: (i: number) => void; kind: "line" | "area" | "bar" }) {
  const gid = useId().replace(/:/g, "");
  const n = expense.length;
  const y = scale([expense, income], H);
  const x = (i: number) => (n <= 1 ? (PAD_L + W - PAD) / 2 : PAD_L + (i / (n - 1)) * (W - PAD_L - PAD));

  if (kind === "bar") {
    const max = Math.max(1, ...expense, ...income);
    const slot = (W - PAD_L - PAD) / n;
    const bw = Math.min(22, slot * 0.24);
    return (
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full" role="img" aria-label="Monthly spending bars">
          <AxisGrid max={max} y={y} />
          {expense.map((_, i) => (
            <line key={`v${i}`} x1={x(i)} x2={x(i)} y1={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="2 4" />
          ))}
          {expense.map((v, i) => {
            const cx = x(i);
            const on = i === selected;
            return (
              <g key={i} onClick={() => onSelect(i)} className="cursor-pointer">
                <rect x={PAD_L} width={W - PAD_L - PAD} y={0} height={H} fill="transparent" />
                <rect
                  x={cx - bw - 2} y={y(income[i] ?? 0)} width={bw} height={Math.max(2, H - PAD - y(income[i] ?? 0))}
                  rx={3} fill={on ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.22)"}
                  style={{ transition: "all .3s" }}
                />
                <rect
                  x={cx + 2} y={y(v)} width={bw} height={Math.max(2, H - PAD - y(v))}
                  rx={3} fill={on ? "#ffffff" : "rgba(255,255,255,0.75)"}
                  style={{ transition: "all .3s" }}
                />
                {on && <circle cx={cx} cy={y(v) - 8} r={3} fill="#fff" />}
              </g>
            );
          })}
        </svg>
        <div className="mt-1 flex justify-between px-1">
          {labels.map((l, i) => (
            <button key={l + i} onClick={() => onSelect(i)} className={cn("label text-[10px]", i === selected ? "!text-white" : "")}>{l}</button>
          ))}
        </div>
        <div className="sr-only">Max {max}</div>
      </div>
    );
  }

  const eLine = (() => {
    const line = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    return line(expense);
  })();
  const iLine = (() => {
    const line = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    return line(income);
  })();
  const trendMax = Math.max(1, ...expense, ...income);
  const area = `${eLine} L${x(n - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label="Monthly spending trend">
        <defs>
          <linearGradient id={`ta${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff0cc" stopOpacity="0.22" />
            <stop offset="1" stopColor="#fff0cc" stopOpacity="0" />
          </linearGradient>
        </defs>
        <AxisGrid max={trendMax} y={y} />
        {expense.map((_, i) => (
          <line key={`v${i}`} x1={x(i)} x2={x(i)} y1={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
        ))}
        {kind === "area" && <path d={area} fill={`url(#ta${gid})`} />}
        <path d={iLine} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.4" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path
          key={kind + expense.join(",")}
          d={eLine} fill="none" stroke="#fff0cc" strokeWidth="2.2" strokeLinecap="round"
          pathLength={1} strokeDasharray={1} strokeDashoffset={1} vectorEffect="non-scaling-stroke"
          style={{ animation: "draw 1.4s cubic-bezier(.22,1,.36,1) .1s forwards" }}
        />
        {expense.map((v, i) => (
          <g key={i} onClick={() => onSelect(i)} className="cursor-pointer">
            <circle cx={x(i)} cy={0} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(v)} r={i === selected ? 4.5 : 2.5} fill={i === selected ? "#fff" : "rgba(255,240,204,0.7)"} style={{ transition: "all .25s" }} />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-1">
        {labels.map((l, i) => (
          <button key={l + i} onClick={() => onSelect(i)} className={cn("label text-[10px]", i === selected ? "!text-white" : "")}>{l}</button>
        ))}
      </div>
    </div>
  );
}

/* ---------- pie (tap a slice) ---------- */

function polar(cx: number, cy: number, r: number, a: number) {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function PieChart({
  segments, selected, onSelect, size = 200,
}: { segments: { id: string; value: number; color: string }[]; selected?: string | null; onSelect?: (id: string) => void; size?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = size / 2 - 6;
  const c = size / 2;
  // Pure angle ranges (no render-phase mutation): [start, end] per slice.
  const fracs = segments.map((s) => (s.value / total) * Math.PI * 2);
  const pairs = fracs.map((_, i) => {
    const a0 = -Math.PI / 2 + fracs.slice(0, i).reduce((x, y) => x + y, 0);
    return [a0, a0 + fracs[i]] as [number, number];
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Spending breakdown pie">
      {segments.map((s, i) => {
        const frac = s.value / total;
        const [a0, a1] = pairs[i];
        const large = frac > 0.5 ? 1 : 0;
        const [x0, y0] = polar(c, c, r, a0);
        const [x1, y1] = polar(c, c, r, a1);
        const on = selected === s.id;
        const mid = (a0 + a1) / 2;
        const dx = on ? Math.cos(mid) * 5 : 0;
        const dy = on ? Math.sin(mid) * 5 : 0;
        const d = frac >= 1 ? "" : `M${c},${c} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`;
        return (
          <g key={s.id} transform={`translate(${dx},${dy})`} onClick={() => onSelect?.(s.id)} className="cursor-pointer">
            {frac >= 1 ? (
              <circle cx={c} cy={c} r={r} fill={s.color} opacity={on ? 1 : 0.85} style={{ transition: "all .3s" }} />
            ) : (
              <path d={d} fill={s.color} opacity={on || !selected ? 1 : 0.38} stroke="#0f1011" strokeWidth={2} style={{ transition: "all .3s" }} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- gauge (savings rate dial) ---------- */

export function GaugeChart({ value, display, sub }: { value: number; display: string; sub?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const Wg = 260;
  const Hg = 150;
  const cx = Wg / 2;
  const cy = 128;
  const r = 100;
  const arc = (f0: number, f1: number) => {
    const [x0, y0] = polar(cx, cy, r, Math.PI + f0 * Math.PI);
    const [x1, y1] = polar(cx, cy, r, Math.PI + f1 * Math.PI);
    return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}`;
  };
  const [nx, ny] = polar(cx, cy, r - 22, Math.PI + v * Math.PI);
  return (
    <div className="text-center">
      <svg viewBox={`0 0 ${Wg} ${Hg}`} className="mx-auto h-[140px]" role="img" aria-label={`Gauge ${display}`}>
        <path d={arc(0, 1)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={16} strokeLinecap="round" />
        <path
          key={Math.round(v * 100)}
          d={arc(0, Math.max(v, 0.015))}
          fill="none"
          stroke={v >= 0.2 ? "#8fb8a0" : v >= 0 ? "#fff0cc" : "#ff9a9a"}
          strokeWidth={16}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          style={{ animation: "draw 1.2s cubic-bezier(.22,1,.36,1) .1s forwards" }}
        />
        <circle cx={nx} cy={ny} r={5} fill="#fff" />
      </svg>
      <div className="-mt-9">
        <div className="font-display tabular text-[40px] leading-none">{display}</div>
        {sub && <div className="label mt-1.5 text-[10px]">{sub}</div>}
      </div>
    </div>
  );
}

/* ---------- ring progress (goals) ---------- */

export function RingChart({
  value, size = 64, stroke = 6, color = "#fff", children,
}: { value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${v * circ} ${circ}`} style={{ transition: "stroke-dasharray .9s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/* ---------- self-contained selectable breakdown (pie + side legend) ---------- */

export function Breakdown({
  data, fmt, centerLabel, centerValue,
}: {
  data: { id: string; label: string; sub?: string; color: string; amount: number }[];
  fmt: (v: number) => string;
  centerLabel: string;
  centerValue: string;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const active = data.find((i) => i.id === sel);
  const items: LegendItem[] = data.map((d) => ({ id: d.id, label: d.label, sub: d.sub, color: d.color, value: fmt(d.amount) }));
  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="mx-auto">
        <div className="relative">
          <PieChart
            segments={data.map((d) => ({ id: d.id, value: d.amount, color: d.color }))}
            selected={sel}
            onSelect={(id) => setSel((s) => (s === id ? null : id))}
            size={190}
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div className="px-10">
              <div className="label text-[10px]">{active ? active.label : centerLabel}</div>
              <div className="font-display tabular text-[26px] leading-tight">{active ? fmt(active.amount) : centerValue}</div>
            </div>
          </div>
        </div>
      </div>
      <SideLegend items={items} selected={sel} onSelect={(id) => setSel((s) => (s === id ? null : id))} />
    </div>
  );
}
