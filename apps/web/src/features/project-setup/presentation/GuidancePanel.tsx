"use client";

import type { Guidance } from "../copy";
import { DosDonts } from "./DosDonts";
import { useSetupCopy } from "./useSetupCopy";

/**
 * The instructions every step carries: what to check, do's and don'ts, the options on offer and one friendly tip. One
 * component for all steps, so every step is instructed the same way and a new step only needs its wording.
 */
export function GuidancePanel({ guide }: { guide: Pick<Guidance, "checks" | "dos" | "donts" | "options" | "tip"> }) {
  const { c } = useSetupCopy();
  return (
    <div className="space-y-5">
      {guide.checks.length > 0 && (
        <section aria-label={c.common.whatToCheck} className="rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/10 dark:bg-slate-900/50">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.common.whatToCheck}</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
            {guide.checks.map((item) => (
              <li key={item} className="flex gap-2"><span aria-hidden="true" className="text-accent-500">◆</span><span>{item}</span></li>
            ))}
          </ul>
        </section>
      )}
      <DosDonts dos={guide.dos} donts={guide.donts} />
      <section aria-label={c.common.yourOptions}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.common.yourOptions}</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {guide.options.map((o) => (
            <li key={o.label} className="rounded-lg border border-brand-300/50 bg-brand-50 p-3 dark:border-brand-400/20 dark:bg-brand-400/5">
              <p className="text-sm font-medium text-brand-800 dark:text-brand-200">{o.label}</p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{o.text}</p>
            </li>
          ))}
        </ul>
      </section>
      <p className="rounded-lg bg-accent-300/20 px-4 py-3 text-sm text-slate-700 dark:bg-accent-500/10 dark:text-slate-200">
        <span className="font-semibold">{c.common.tip} </span>{guide.tip}
      </p>
    </div>
  );
}
