"use client";

import { DosDonts } from "./DosDonts";
import { useSetupCopy } from "./useSetupCopy";

/** Slide one: what this does, what you get, and the rules of the road, before anything is asked of the person. */
export function GuideSlide({ onStart }: { onStart: () => void }) {
  const { c, n } = useSetupCopy();
  const w = c.welcome;
  return (
    <>
      <p className="inline-flex items-center gap-2 rounded-full bg-accent-300/25 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-accent-500/15 dark:text-slate-200">
        <span aria-hidden="true">⏱</span>{w.time}
      </p>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{w.howTitle}</h2>
      <ol aria-label={w.howTitle} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {w.how.map((s, i) => (
          <li key={s.title} className="relative rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/10 dark:bg-slate-900/50">
            <span aria-hidden="true" className="absolute -top-3 start-4 grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-accent-400 text-sm font-bold text-white shadow">{n(i + 1)}</span>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{s.title}</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label={w.youGetTitle} className="rounded-xl border border-accent-400/30 bg-accent-300/10 p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{w.youGetTitle}</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
            {w.youGet.map((t) => <li key={t} className="flex gap-2"><span aria-hidden="true" className="text-accent-500">✓</span>{t}</li>)}
          </ul>
        </section>
        <section aria-label={w.wontDoTitle} className="rounded-xl border border-slate-200/70 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{w.wontDoTitle}</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
            {w.wontDo.map((t) => <li key={t} className="flex gap-2"><span aria-hidden="true" className="text-slate-400">–</span>{t}</li>)}
          </ul>
        </section>
      </div>
      <DosDonts dos={w.dos} donts={w.donts} />
      <p className="flex gap-2 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200">
        <span aria-hidden="true">🔒</span><span>{w.privacy}</span>
      </p>
      <div className="flex justify-center pt-2">
        <button type="button" className="btn px-8 py-3 text-base shadow-lg shadow-brand-600/20" onClick={onStart}>{w.start} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span></button>
      </div>
    </>
  );
}
