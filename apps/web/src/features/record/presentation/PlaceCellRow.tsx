"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { cellProblem, type PlaceFirstCell, type SplitRow } from "../domain/place-first";

const DIMENSIONS = ["SEX", "AGE_GROUP", "DISABILITY", "OTHER"] as const;
type Lock = "VERIFIED" | "CALCULATED" | "PERIOD_LOCKED" | "NOT_APPLICABLE";
const LOCKS: ReadonlySet<string> = new Set<Lock>(["VERIFIED", "CALCULATED", "PERIOD_LOCKED", "NOT_APPLICABLE"]);

/**
 * One indicator at the chosen place: a big number box, its stored figure as the starting text, and an optional split inside the place
 * (sex, age group, ...) that must add up to the place's figure. A locked figure is shown with the reason and cannot be typed into.
 */
export function PlaceCellRow({ cell, typed, splits, onType, onSplits }: { cell: PlaceFirstCell; typed: string; splits: readonly SplitRow[]; onType: (value: string) => void; onSplits: (rows: SplitRow[]) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(splits.length > 0);
  const id = `place-cell-${cell.indicatorId}`;
  const problem = cellProblem(typed, cell, splits);
  const dimension = splits[0]?.dimension ?? "SEX";
  const rows = splits.length ? splits : [{ dimension, category: "", value: "" }];
  const setRow = (i: number, patch: Partial<SplitRow>) => onSplits(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <li className="space-y-2 py-3">
      <label htmlFor={id} className="block text-base font-semibold">
        <span className="font-mono text-sm text-slate-500">{cell.code}</span> {cell.name}{cell.unit ? ` (${cell.unit})` : ""}
      </label>
      {cell.locked ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{cell.stored || "—"} · {LOCKS.has(cell.lockReason ?? "") ? t(`placeEntry.lock.${cell.lockReason as Lock}`) : t("placeSheet.locked")}</p>
      ) : (
        <>
          <Input id={id} inputMode="decimal" className="min-h-[52px] text-lg" value={typed} onChange={(e) => onType(e.target.value)} aria-invalid={problem ? true : undefined} />
          {!cell.adds && <p className="text-xs text-slate-500">{t("placeEntry.rate")}</p>}
          {problem && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t(problem.key, problem.params)}</p>}
          {cell.adds && typed.trim() !== "" && (
            <button type="button" className="link inline-flex min-h-11 items-center text-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? t("placeEntry.splitHide") : t("placeEntry.splitShow")}</button>
          )}
          {open && cell.adds && typed.trim() !== "" && (
            <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <label className="label" htmlFor={`${id}-dim`}>{t("placeEntry.splitBy")}</label>
              <select id={`${id}-dim`} className="input min-h-11" value={dimension} onChange={(e) => onSplits(rows.map((r) => ({ ...r, dimension: e.target.value })))}>
                {DIMENSIONS.map((d) => <option key={d} value={d}>{t(`placeEntry.dimension.${d}`)}</option>)}
              </select>
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <Input aria-label={t("placeEntry.group")} placeholder={t("placeEntry.group")} value={r.category} onChange={(e) => setRow(i, { category: e.target.value })} />
                  <Input aria-label={`${r.category || t("placeEntry.group")}`} inputMode="decimal" value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} />
                </div>
              ))}
              <button type="button" className="btn-ghost btn-sm" onClick={() => onSplits([...rows, { dimension, category: "", value: "" }])}>{t("placeEntry.addGroup")}</button>
            </div>
          )}
        </>
      )}
    </li>
  );
}
