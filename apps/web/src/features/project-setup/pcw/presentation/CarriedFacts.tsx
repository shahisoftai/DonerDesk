"use client";

import type { SlideKey } from "@donordesk/domain";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { carriedFacts } from "../domain/carried-facts";
import { usePcwCopy } from "./usePcwCopy";

/** What this slide reuses from an earlier one, with where it came from, so no fact is asked twice and none is a surprise. */
export function CarriedFacts({ view, slide }: { view: SetupDraftView; slide: SlideKey }) {
  const pcw = usePcwCopy();
  const c = pcw.c.simple;
  const facts = carriedFacts(view, slide);
  if (facts.length === 0) return null;
  return (
    <section aria-label={c.carriedTitle} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5" data-testid="carried-facts">
      <p className="font-medium">{c.carriedTitle}</p>
      <ul className="mt-1 space-y-0.5 text-slate-700 dark:text-slate-200">
        {facts.map((f) => <li key={f.key}><span className="font-medium">{c.carriedLabel[f.key] ?? f.key}:</span> {f.value} <span className="text-slate-500 dark:text-slate-400">({c.carriedFrom(pcw.slides[f.from].label)})</span></li>)}
      </ul>
    </section>
  );
}
