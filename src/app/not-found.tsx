import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-obsidian px-6 text-center">
      <div>
        <div className="label mb-4">404 — Lost</div>
        <h1 className="font-display text-[44px] leading-none sm:text-[56px]">That page <em>wandered off.</em></h1>
        <p className="mx-auto mt-4 max-w-[380px] text-[15px] font-light text-ash">The link may be old, or the page moved. Your money is still safe.</p>
        <div className="mt-8 flex justify-center gap-2">
          <Link href="/" className="inline-flex h-12 items-center rounded-lg bg-white px-6 text-[15px] text-black">Back home</Link>
          <Link href="/app" className="inline-flex h-12 items-center rounded-lg border border-white/20 px-6 text-[15px] text-white hover:bg-white/10">Open app</Link>
        </div>
      </div>
    </div>
  );
}
