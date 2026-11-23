"use client";

import { computeScore, type ScoreRules } from "@donordesk/domain/contexts/collection/index.js";

/**
 * The score so far, from the same rules the server uses. It says how many items it stands on, never shows a band before enough is answered,
 * and says when the weights and bands are only illustrative.
 */
export function ScorePanel({ rules, values, t }: { rules: ScoreRules; values: Readonly<Record<string, unknown>>; t(key: string, params?: Record<string, string | number>): string }) {
  const s = computeScore(rules, values);
  const tone = s.band?.tone === "GOOD" ? "text-emerald-700 dark:text-emerald-300" : s.band?.tone === "POOR" ? "text-danger-600" : "text-amber-700 dark:text-amber-300";
  return (
    <aside aria-label={t("assess.score.title")} className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700">
      <p className="font-medium">{t("assess.score.title")}</p>
      <p className="mt-1 text-2xl tabular-nums">{s.overall === null ? "—" : `${s.overall}%`}</p>
      {s.band ? <p className={`font-medium ${tone}`}>{s.band.label}</p> : <p className="text-slate-500">{s.bandWithheld === "NOTHING_ANSWERED" ? t("assess.score.none") : t("assess.score.waiting")}</p>}
      <p className="mt-1 text-xs text-slate-500">{t("assess.score.basis", { answered: s.answered, total: s.total })}</p>
      {s.illustrative && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t("assess.score.illustrative")}</p>}
      <ul className="mt-2 space-y-1">
        {s.sections.filter((x) => x.percent !== null).slice(0, 40).map((x) => <li key={x.key} className="flex justify-between gap-2"><span className="min-w-0 break-words">{x.title}</span><span className="tabular-nums">{x.percent}%</span></li>)}
      </ul>
    </aside>
  );
}
