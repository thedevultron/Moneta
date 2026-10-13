"use client";

import { useId, type ReactNode } from "react";

export function CumulativeChart({ current, previous, days }: { current: number[]; previous: number[]; days: number }) {
  const id = useId().replace(/:/g, "");
  const W = 300;
  const H = 130;
  const PAD_L = 36;
  const PAD_B = 16;
  const max = Math.max(1, ...current, ...previous.slice(0, days));
  const x = (i: number) => (days <= 1 ? PAD_L : PAD_L + (i / (days - 1)) * (W - PAD_L - 4));
  const y = (v: number) => H - PAD_B - 4 - (v / max) * (H - PAD_B - 20);
  const line = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const cur = current.length ? line(current) : "";
  const lastI = current.length - 1;
  const area = current.length ? `${cur} L${x(lastI).toFixed(1)},${H - PAD_B} L${x(0).toFixed(1)},${H - PAD_B} Z` : "";
  const fmtTick = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${Math.round(v)}`);
  const yTicks = [0, max / 2, max];
  const xTicks = days <= 1 ? [1] : [1, Math.ceil(days / 2), days];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-[130px] w-full min-w-0 overflow-visible" preserveAspectRatio="none" role="img" aria-label="Cumulative spending this month">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#847dff" />
          <stop offset="0.45" stopColor="#d1c9ff" />
          <stop offset="1" stopColor="#847dff" />
        </linearGradient>
        <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d1c9ff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#d1c9ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Y-axis dotted gridlines through the full chart + value markings */}
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={PAD_L} x2={W} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.16)" strokeWidth="1" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
          <text x={2} y={y(t) + 3} fontSize={8} fill="rgba(255,255,255,0.45)" fontFamily="monospace">{fmtTick(t)}</text>
        </g>
      ))}
      {/* X-axis dotted verticals + day markings */}
      {[0.25, 0.5, 0.75].map((f) => {
        const vx = PAD_L + f * (W - PAD_L - 4);
        return <line key={f} x1={vx} x2={vx} y1={8} y2={H - PAD_B} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />;
      })}
      <line x1={PAD_L} x2={W} y1={H - PAD_B} y2={H - PAD_B} stroke="rgba(255,255,255,0.25)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {xTicks.map((d) => {
        const i = Math.min(Math.max(d - 1, 0), Math.max(days - 1, 0));
        return <text key={d} x={x(i)} y={H - 4} fontSize={8} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontFamily="monospace">{d}</text>;
      })}
      {previous.length > 0 && (
        <path d={line(previous.slice(0, days))} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      )}
      {area && <path d={area} fill={`url(#a${id})`} />}
      {cur && (
        <path
          key={current.length + ":" + Math.round(current[lastI] ?? 0)}
          d={cur}
          fill="none"
          stroke={`url(#g${id})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          vectorEffect="non-scaling-stroke"
          style={{ animation: "draw 1.6s cubic-bezier(.22,1,.36,1) .1s forwards" }}
        />
      )}
    </svg>
  );
}

export function Donut({ segments, size = 180, thickness = 18, children }: { segments: { value: number; color: string }[]; size?: number; thickness?: number; children?: ReactNode }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const gap = segments.length > 1 ? 3 : 0;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${Math.max(len - gap, 0)} ${c}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              style={{ transition: "stroke-dasharray .8s ease" }}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Ring({ value, size = 56, stroke = 5, color = "#fff", children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${v * c} ${c}`}
          style={{ transition: "stroke-dasharray .9s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
