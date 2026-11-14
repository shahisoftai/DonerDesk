"use client";

import { useState } from "react";
import type { TidyStep } from "@donordesk/domain/contexts/datasets/browser.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { headerOf, readAs } from "../domain/wizard";
import type { CheckResult } from "../domain/types";

/**
 * Screen 4: place values the places list does not know (or knows twice). Each can be read as a known place (a recorded step, replayed on
 * every refresh) or left: its rows are kept, listed apart, never placed at a guess.
 */
export function PlacesStep({ check, steps, onApply, onBack, onNext }: { check: CheckResult; steps: TidyStep[]; onApply: (s: TidyStep[]) => void; onBack: () => void; onNext: () => void }) {
  const { t } = useI18n();
  const placeCols = check.columns.filter((c) => c.semantic === "PLACE");
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [column, setColumn] = useState(placeCols[0]?.key ?? "");
  return (
    <div className="space-y-3">
      {placeCols.length === 0 ? <p className="text-sm text-slate-600">{t("ds.places.noColumn")}</p> : (
        <p className="text-sm">{t("ds.places.matched", { n: check.placesMatched })}</p>
      )}
      {check.places.length === 0 && placeCols.length > 0 && <p className="text-sm text-emerald-800">{t("ds.places.allKnown")}</p>}
      {check.places.length > 0 && (
        <>
          {placeCols.length > 1 && <label className="text-sm">{t("ds.places.column")} <select className="rounded border border-slate-300 px-1 dark:border-slate-600 dark:bg-slate-900" value={column} onChange={(e) => setColumn(e.target.value)}>{placeCols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>}
          <ul className="space-y-2">
            {check.places.map((p) => (
              <li key={p.value} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-48 font-medium">{p.value}</span>
                <span className="text-xs text-slate-500">{p.status === "AMBIGUOUS" ? t("ds.places.ambiguous") : t("ds.places.unknown")} · {t("ds.table.rows", { n: p.rows })}</span>
                <input aria-label={t("ds.places.readAs", { value: p.value })} placeholder={t("ds.places.readAsPlaceholder")} className="rounded border border-slate-300 px-2 py-0.5 dark:border-slate-600 dark:bg-slate-900" value={typed[p.value] ?? ""} onChange={(e) => setTyped({ ...typed, [p.value]: e.target.value })} />
                <button type="button" disabled={!typed[p.value]?.trim()} className="rounded border border-brand-700 px-2 py-0.5 text-xs text-brand-800 disabled:opacity-50" onClick={() => onApply(readAs(steps, headerOf(check.columns, column), p.value, typed[p.value]!.trim()))}>{t("ds.places.remember")}</button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">{t("ds.places.addHint")} <a className="underline" href="/settings/places">{t("ds.places.openList")}</a></p>
        </>
      )}
      <div className="flex gap-2"><button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" onClick={onBack}>{t("ds.back")}</button><button type="button" className="rounded bg-brand-700 px-3 py-1.5 text-sm font-medium text-white" onClick={onNext}>{t("ds.next")}</button></div>
    </div>
  );
}
