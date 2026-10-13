"use client";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="15" stroke="white" strokeOpacity=".35" />
      <text
        x="16"
        y="22.5"
        textAnchor="middle"
        fill="white"
        fontSize="19"
        fontStyle="italic"
        fontFamily="Newsreader, Georgia, 'Times New Roman', serif"
      >
        M
      </text>
    </svg>
  );
}
