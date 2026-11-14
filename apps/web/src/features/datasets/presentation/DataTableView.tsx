"use client";

import type { VisualTable } from "@donordesk/domain/contexts/visual-data/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

const fmt = (v: unknown, rate: boolean): string => (typeof v === "number" ? `${v.toLocaleString(undefined, { maximumFractionDigits: rate ? 1 : 2 })}${rate ? " %" : ""}` : v === null || v === undefined || v === "" ? "" : String(v));

/**
 * A dataset table, and the "map" family's ranked list of places with a bar for the figure (§3.7). A gap reads "Not reported", never 0.
 * Clicking a row's first cell filters the canvas by it.
 */
export function DataTableView({ table, ranked, onPick, selected }: { table: VisualTable; ranked?: boolean; onPick?: ((v: string) => void) | undefined; selected: readonly string[] }) {
  const { t } = useI18n();
  const first = table.columns[0];
  const measure = table.columns.find((c) => c.role !== "DIMENSION");
  const rows = ranked && measure ? [...table.rows].sort((a, b) => (Number(b[measure.id] ?? -Infinity) - Number(a[measure.id] ?? -Infinity))) : table.rows;
  const max = measure ? Math.max(0, ...rows.map((r) => (typeof r[measure.id] === "number" ? (r[measure.id] as number) : 0))) : 0;
  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-white dark:bg-slate-900"><tr>{table.columns.map((c) => <th key={c.id} scope="col" className={`px-2 py-1 font-medium text-slate-600 ${c.role === "DIMENSION" ? "text-start" : "text-end"}`}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const key = first ? String(r[first.id] ?? "") : "";
            const on = selected.includes(key);
            return (
              <tr key={i} className={`border-t border-slate-100 dark:border-slate-800 ${selected.length && !on ? "opacity-50" : ""}`}>
                {table.columns.map((c, k) => {
                  const v = r[c.id];
                  const text = fmt(v, c.type === "RATE");
                  if (k === 0 && onPick && c.role === "DIMENSION") return <td key={c.id} className="px-2 py-1"><button type="button" className="text-start underline-offset-2 hover:underline" aria-pressed={on} onClick={() => onPick(key)}>{text || t("ds.notStated")}</button></td>;
                  const bar = ranked && c.id === measure?.id && typeof v === "number" && max > 0;
                  return (
                    <td key={c.id} className={`px-2 py-1 ${c.role === "DIMENSION" ? "" : "text-end tabular-nums"}`}>
                      {bar && <span aria-hidden className="me-2 inline-block h-2 rounded-sm bg-brand-600 align-middle" style={{ width: `${Math.max(2, (Number(v) / max) * 80)}px` }} />}
                      {text || (c.role === "DIMENSION" ? t("ds.notStated") : <span className="text-slate-400">{t("ds.notReported")}</span>)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {ranked && <p className="mt-1 text-[11px] text-slate-500">{t("ds.visual.mapAsList")}</p>}
    </div>
  );
}
