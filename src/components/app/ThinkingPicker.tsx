"use client";

import { useApp } from "@/components/app/DataProvider";

const THINK_LEVELS = ["minimal", "low", "medium", "high"] as const;

/** Thinking-level picker shared by chat + voice (stored on the profile). */
export function ThinkingPicker() {
  const { user, updateProfile } = useApp();
  const cur = (["minimal", "low", "medium", "high"].includes(user.thinkingLevel) ? user.thinkingLevel : "medium") as (typeof THINK_LEVELS)[number];
  return (
    <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Thinking level">
      <span className="label shrink-0 text-[10px]">Thinking</span>
      {THINK_LEVELS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={cur === l}
          onClick={() => void updateProfile({ thinkingLevel: l })}
          className={`shrink-0 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all active:scale-95 ${cur === l ? "border-white bg-white text-black" : "border-white/15 text-ash"}`}
        >
          {l === "minimal" ? "Quick" : l === "medium" ? "Deep" : l[0].toUpperCase() + l.slice(1)}
        </button>
      ))}
    </div>
  );
}
