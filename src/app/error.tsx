"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-obsidian px-6 text-center">
      <div>
        <div className="label mb-4">Something hiccuped</div>
        <h1 className="font-display text-[44px] leading-none sm:text-[56px]">Let&apos;s <em>try again.</em></h1>
        <p className="mx-auto mt-4 max-w-[380px] text-[15px] font-light text-ash">A temporary glitch — none of your data was lost.</p>
        <button onClick={() => reset()} className="mt-8 inline-flex h-12 items-center rounded-lg bg-white px-6 text-[15px] text-black">Reload</button>
      </div>
    </div>
  );
}
