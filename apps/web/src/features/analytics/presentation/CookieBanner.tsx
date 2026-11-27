"use client";

import Link from "next/link";

const BUTTON = "rounded-lg border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300";

/**
 * The cookie question. Yes and no look the same and sit side by side, so neither is easier to press than the other.
 * It only draws; what happens on a choice is decided by the caller.
 */
export function CookieBanner({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <aside
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-5xl rounded-lg border border-cyan-300/20 bg-slate-950/95 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.8)] backdrop-blur-2xl sm:p-5"
    >
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-sm font-medium text-white">Can we count your visit?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            With your permission we use Google Analytics cookies on our public pages to see how many people visit and which pages help.
            Nothing is sent to Google unless you accept, and we never use analytics inside the signed-in app. We keep your choice for six
            months, and you can change it at any time from &ldquo;Cookie settings&rdquo; in the footer.{" "}
            <Link href="/cookies" className="font-semibold text-brand-300 underline decoration-brand-400/40 underline-offset-2 hover:text-cyan-200">
              Read our cookie policy
            </Link>
            .
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <button type="button" onClick={onDecline} className={BUTTON}>Decline</button>
          <button type="button" onClick={onAccept} className={BUTTON}>Accept</button>
        </div>
      </div>
    </aside>
  );
}
