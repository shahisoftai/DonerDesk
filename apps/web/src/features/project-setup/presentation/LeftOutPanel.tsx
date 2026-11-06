"use client";

import type { LeftOutView } from "../domain/review-state";
import { useSetupCopy } from "./useSetupCopy";

/** What the reading found but could not find word for word in the documents: shown, never silently dropped. */
export function LeftOutPanel({ items, total }: { items: ReadonlyArray<LeftOutView>; total: number }) {
  const { c } = useSetupCopy();
  const rv = c.review;
  if (total === 0) return null;
  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
      <summary className="cursor-pointer select-none font-medium text-slate-800 dark:text-slate-100">{rv.leftOutTitle(total)}</summary>
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{rv.leftOutLead}</p>
      <ul className="mt-2 space-y-1">
        {items.map((item, i) => (
          <li key={`${item.field}-${i}`} className="text-xs text-slate-700 dark:text-slate-200">
            “{item.text}” <span className="text-slate-500 dark:text-slate-400">· {rv.leftOutReasons[item.reason]}</span>
          </li>
        ))}
      </ul>
      {items.length < total && <p className="mt-2 text-xs text-slate-500">{rv.leftOutShown(items.length, total)}</p>}
    </details>
  );
}
