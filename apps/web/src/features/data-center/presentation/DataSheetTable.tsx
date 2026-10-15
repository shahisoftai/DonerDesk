"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cellPercentOfTarget, indexCells, indicatorSheetRows, INDICATOR_SHEET_HEADERS, pivotSheet, PIVOT_MEASURE_LABEL, toCsv, type PivotMeasure } from "@donordesk/domain/contexts/reporting/data-sheet.js";
import type { DataSheetResponse } from "@/lib/server/schemas";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { indicatorVerificationTone } from "@/lib/shared/tone";
import { INDICATOR_VERIFICATION_LABEL } from "@/lib/labels";
import { downloadTextFile } from "./download";

type View = "BY_PERIOD" | "LIST";

const th = "whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const td = "whitespace-nowrap px-3 py-2";

export function DataSheetTable({ projectId, sheet, canEdit }: { projectId: string; sheet: DataSheetResponse; canEdit: boolean }) {
  const [view, setView] = useState<View>("BY_PERIOD");
  const [measure, setMeasure] = useState<PivotMeasure>("PERIOD");
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [periodId, setPeriodId] = useState("");

  const levels = useMemo(() => [...new Set(sheet.indicators.map((i) => i.level).filter((l): l is string => Boolean(l)))], [sheet.indicators]);
  const cells = useMemo(() => indexCells(sheet), [sheet]);
  const visibleIndicators = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sheet.indicators.filter((i) => (!level || i.level === level) && (!q || i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)));
  }, [sheet.indicators, search, level]);
  const visiblePeriods = periodId ? sheet.periods.filter((p) => p.id === periodId) : sheet.periods;
  const entryHref = (id: string): string => `/projects/${projectId}/reports/${id}/inputs?tab=indicators`;

  function exportCsv(): void {
    const scoped = { ...sheet, indicators: visibleIndicators, periods: visiblePeriods };
    const table = view === "BY_PERIOD" ? (() => { const p = pivotSheet(scoped, measure); return [p.headers, ...p.rows]; })() : [[...INDICATOR_SHEET_HEADERS], ...indicatorSheetRows(scoped)];
    downloadTextFile(view === "BY_PERIOD" ? "data-sheet-by-period.csv" : "data-sheet.csv", toCsv(table));
  }

  if (sheet.indicators.length === 0) {
    return <p className="card text-sm text-slate-500">This project has no indicators yet. Add them in the Logframe, then record values to see them here.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1" role="tablist" aria-label="Sheet layout">
          {([["BY_PERIOD", "By period"], ["LIST", "List"]] as const).map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? "bg-brand-500/15 text-brand-700 dark:text-brand-300" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"}`}>
              {label}
            </button>
          ))}
        </div>
        {view === "BY_PERIOD" && (
          <label className="text-xs text-slate-500">
            Show
            <Select className="mt-1" value={measure} onChange={(e) => setMeasure(e.target.value as PivotMeasure)}>
              {(Object.keys(PIVOT_MEASURE_LABEL) as PivotMeasure[]).map((m) => <option key={m} value={m}>{PIVOT_MEASURE_LABEL[m]}</option>)}
            </Select>
          </label>
        )}
        <label className="text-xs text-slate-500">
          Find indicator
          <Input className="mt-1" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code or name" />
        </label>
        {levels.length > 1 && (
          <label className="text-xs text-slate-500">
            Level
            <Select className="mt-1" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All levels</option>
              {levels.map((l) => <option key={l} value={l}>{l.charAt(0) + l.slice(1).toLowerCase()}</option>)}
            </Select>
          </label>
        )}
        {view === "LIST" && (
          <label className="text-xs text-slate-500">
            Period
            <Select className="mt-1" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
              <option value="">All periods</option>
              {sheet.periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </label>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv}>Download CSV</Button>
          <a className="btn-secondary" href={`/api/projects/${projectId}/data-sheet/export`}>Download Excel</a>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {canEdit ? "To change a value, open its period (the column heading or the Edit link): values are entered, reviewed and verified there. To change many at once, download, edit and import the file." : "You can view and download this sheet."}
        {" "}An empty cell means nothing is recorded; it is never counted as 0.
      </p>

      {visibleIndicators.length === 0 ? (
        <p className="card mt-4 text-sm text-slate-500">No indicator matches the filters.</p>
      ) : view === "BY_PERIOD" ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/5">
              <tr>
                <th className={`${th} sticky left-0 z-10 bg-slate-50 dark:bg-slate-900`}>Indicator</th>
                <th className={th}>Unit</th>
                <th className={`${th} text-right`}>Baseline</th>
                <th className={`${th} text-right`}>Target</th>
                {sheet.periods.map((p) => (
                  <th key={p.id} className={`${th} text-right`}>
                    <Link className="hover:text-brand-600 hover:underline" href={entryHref(p.id)} title={p.locked ? "Closed: values cannot be changed" : "Open this period to enter or edit values"}>
                      {p.label}{p.locked ? " (closed)" : ""}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {visibleIndicators.map((i) => (
                <tr key={i.id}>
                  <td className={`${td} sticky left-0 bg-white dark:bg-slate-900`}>
                    <Link href={`/projects/${projectId}/indicators/${i.id}`} className="font-mono text-xs text-slate-500 hover:underline">{i.code}</Link>
                    <div className="max-w-[18rem] truncate" title={i.name}>{i.name}</div>
                  </td>
                  <td className={td}>{i.unit ?? ""}</td>
                  <td className={`${td} text-right tabular-nums`}>{i.baseline}</td>
                  <td className={`${td} text-right tabular-nums`}>{i.target}</td>
                  {sheet.periods.map((p) => {
                    const cell = cells.get(`${i.id}|${p.id}`);
                    const value = !cell ? "" : measure === "PERIOD" ? cell.periodValue : measure === "CUMULATIVE" ? cell.cumulativeValue : cellPercentOfTarget(i, cell);
                    return (
                      <td key={p.id} className={`${td} text-right tabular-nums`} title={cell ? INDICATOR_VERIFICATION_LABEL[cell.status] ?? cell.status : "Nothing recorded"}>
                        {value === "" ? <span className="text-slate-300">—</span> : <span className={cell?.status === "VERIFIED" ? "font-medium" : "text-slate-600 dark:text-slate-300"}>{value}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/5">
              <tr>
                <th className={th}>Indicator</th>
                <th className={th}>Period</th>
                <th className={`${th} text-right`}>Period value</th>
                <th className={`${th} text-right`}>Cumulative</th>
                <th className={`${th} text-right`}>% of target</th>
                <th className={th}>Status</th>
                <th className={th}>Data source</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {visibleIndicators.flatMap((i) =>
                visiblePeriods.map((p) => {
                  const cell = cells.get(`${i.id}|${p.id}`);
                  return (
                    <tr key={`${i.id}|${p.id}`}>
                      <td className={td}><span className="font-mono text-xs text-slate-500">{i.code}</span> {i.name}</td>
                      <td className={td}>{p.label}</td>
                      <td className={`${td} text-right tabular-nums`}>{cell?.periodValue || <span className="text-slate-300">—</span>}</td>
                      <td className={`${td} text-right tabular-nums`}>{cell?.cumulativeValue || <span className="text-slate-300">—</span>}</td>
                      <td className={`${td} text-right tabular-nums`}>{cellPercentOfTarget(i, cell) || <span className="text-slate-300">—</span>}</td>
                      <td className={td}>{cell ? <Badge tone={indicatorVerificationTone(cell.status)}>{INDICATOR_VERIFICATION_LABEL[cell.status] ?? cell.status}</Badge> : ""}</td>
                      <td className={`${td} max-w-[14rem] truncate`} title={cell?.dataSource}>{cell?.dataSource ?? ""}</td>
                      <td className={td}>{p.locked ? <span className="text-xs text-slate-400">Closed</span> : <Link className="text-xs text-brand-600 hover:underline" href={entryHref(p.id)}>Edit</Link>}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
