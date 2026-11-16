"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { getPlaceSheetAction, setPlaceCellsAction } from "@/lib/actions/place-entry";
import type { PlaceSheetResponse } from "@/lib/server/schemas-place-entry";
import { badCells, cellKey, liveTotal, pasteBlock, sheetChanges, sheetLevels, typable } from "../domain/place-sheet-view";
import { PlaceSheetFile } from "./PlaceSheetFile";

/**
 * One period's values by place (Phase 57; the DevResults layout): rows = places, columns = indicators measured by place. Type or paste a
 * block from Excel; Save sends only the changed cells, each merged into its value on the server (totals are added up from the places,
 * never typed). Grey cells are locked or not measured at that place.
 */
export function PlaceSheetView({ projectId, periodId, canEdit }: { projectId: string; periodId: string; canEdit: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [sheet, setSheet] = useState<PlaceSheetResponse | "failed" | null>(null);
  const [typed, setTyped] = useState<Map<string, string>>(new Map());
  const [level, setLevel] = useState<number | "all">("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean; reload?: boolean } | null>(null);

  const load = useCallback(async () => {
    const r = await getPlaceSheetAction(projectId, periodId);
    setSheet(r.ok ? r.value : "failed");
    setTyped(new Map());
  }, [projectId, periodId]);
  useEffect(() => { void load(); }, [load]);

  const data = sheet && sheet !== "failed" ? sheet : null;
  const order = useMemo(() => (data ? data.rows.map((_, i) => i).filter((i) => level === "all" || data.rows[i]!.level === level) : []), [data, level]);
  const bad = useMemo(() => (data ? badCells(data, typed) : new Set<string>()), [data, typed]);
  const changes = useMemo(() => (data ? sheetChanges(data, typed) : []), [data, typed]);

  if (sheet === null) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("record.sheet.loading")}</p>;
  if (sheet === "failed" || !data) return <p role="alert" className="text-sm text-slate-700 dark:text-slate-200">{t("placeSheet.loadFailed")}</p>;
  if (data.columns.length === 0) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("placeSheet.none")}</p>;
  const levels = sheetLevels(data);
  const editable = canEdit && !data.period.locked;

  async function save() {
    if (!data || changes.length === 0 || bad.size > 0) return;
    setBusy(true); setMessage(null);
    const r = await setPlaceCellsAction(projectId, { periodId, handIn: true, cells: changes });
    setBusy(false);
    if (!r.ok) { setMessage({ text: r.error.message, error: true, reload: r.error.kind === "conflict" }); return; }
    setMessage({ text: [t("placeSheet.saved"), ...r.value.notices].join(" "), error: false });
    await load();
    // The By indicator grid and the rest of the page read the same values: refresh them too.
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {levels.length > 1 && (
          <label className="text-sm">
            <span className="label">{t("placeSheet.level")}</span>
            <select className="input min-h-10" value={String(level)} onChange={(e) => setLevel(e.target.value === "all" ? "all" : Number(e.target.value))}>
              <option value="all">{t("placeSheet.allLevels")}</option>
              {levels.map((l) => <option key={l} value={l}>{l >= 0 && l <= 4 ? t(`placeSheet.levelName.${l as 0 | 1 | 2 | 3 | 4}`) : `${t("placeSheet.level")} ${l}`}</option>)}
            </select>
          </label>
        )}
        <PlaceSheetFile projectId={projectId} periodId={periodId} canEdit={editable} onApplied={() => { void load(); router.refresh(); }} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-white/5">
            <tr>
              <th scope="col" className="sticky start-0 z-10 bg-slate-50 px-3 py-2 text-start dark:bg-slate-900">{t("placeSheet.place")}</th>
              {data.columns.map((c) => (
                <th key={c.indicatorId} scope="col" className="min-w-[8rem] px-3 py-2 text-start align-bottom">
                  <span className="block font-mono text-xs text-slate-500">{c.code}</span>
                  <span className="block font-semibold">{c.name}{c.unit ? ` (${c.unit})` : ""}</span>
                  {c.lock && <span className="block text-xs text-slate-500">{t(`placeEntry.lock.${c.lock}`)}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.map((r) => {
              const row = data.rows[r]!;
              return (
                <tr key={row.placeId} className="border-t border-slate-200 dark:border-white/10">
                  <th scope="row" className="sticky start-0 z-10 bg-white px-3 py-1 text-start font-normal dark:bg-slate-950">
                    <span className="block font-semibold">{row.name}</span>
                    {row.path !== row.name && <span className="block text-xs text-slate-500">{row.path}</span>}
                  </th>
                  {data.columns.map((col, c) => {
                    const cell = data.cells[r]![c]!;
                    if (cell === "NOT_MEASURED_HERE") return <td key={col.indicatorId} className="bg-slate-100 px-3 py-1 text-slate-400 dark:bg-white/5" title={t("placeSheet.notMeasured")}>—</td>;
                    const key = cellKey(row.placeId, col.indicatorId);
                    if (!editable || !typable(data, r, c)) return <td key={col.indicatorId} className="bg-slate-50 px-3 py-1 text-slate-600 dark:bg-white/5 dark:text-slate-300">{cell.value}</td>;
                    return (
                      <td key={col.indicatorId} className="px-1 py-1">
                        <input
                          className={`input min-h-9 w-full ${bad.has(key) ? "border-red-500" : ""}`}
                          inputMode="decimal"
                          aria-label={`${row.name}: ${col.code}`}
                          aria-invalid={bad.has(key) ? true : undefined}
                          value={typed.get(key) ?? cell.value}
                          onChange={(e) => setTyped((m) => new Map(m).set(key, e.target.value))}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData("text/plain");
                            if (!text.includes("\t") && !text.includes("\n")) return;
                            e.preventDefault();
                            const pasted = pasteBlock(data, order, { r, c }, text);
                            setTyped((m) => new Map([...m, ...pasted.edits]));
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-white/20 dark:bg-white/5">
            <tr>
              <th scope="row" className="sticky start-0 bg-slate-50 px-3 py-2 text-start dark:bg-slate-900">{t("placeSheet.total")}</th>
              {data.columns.map((col, c) => <td key={col.indicatorId} className="px-3 py-2">{liveTotal(data, typed, c) ?? "—"}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-slate-500">{t("placeEntry.emptyNotZero")}</p>
      {message && (
        <div className="flex flex-wrap items-center gap-3">
          <p role={message.error ? "alert" : "status"} className={`text-sm ${message.error ? "text-red-700 dark:text-red-300" : "text-emerald-800 dark:text-emerald-300"}`}>{message.text}</p>
          {message.reload && <button type="button" className="btn-secondary btn-sm" onClick={() => { setMessage(null); void load(); }}>{t("placeSheet.reload")}</button>}
        </div>
      )}
      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" disabled={busy || changes.length === 0 || bad.size > 0} onClick={() => void save()}>{t("placeSheet.save")}</button>
          {changes.length > 0 && <span className="text-sm text-slate-600 dark:text-slate-300">{t("placeSheet.unsaved", { count: String(changes.length) })}</span>}
        </div>
      )}
    </div>
  );
}
