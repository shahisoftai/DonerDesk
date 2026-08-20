"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkSaveIndicatorUpdatesAction,
  parseIndicatorSheetAction,
  verifyIndicatorUpdateAction,
  type BulkSaveRow,
} from "@/lib/actions/indicators";
import type { PeriodIndicatorRow } from "@/lib/server/schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/data/Badge";
import { useToast } from "@/components/feedback/Toast";
import { indicatorVerificationTone } from "@/lib/shared/tone";
import { INDICATOR_VERIFICATION_LABEL, INDICATOR_TYPE_LABEL, LOGFRAME_LEVEL_LABEL } from "@/lib/labels";

const LEVEL_ORDER = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];

type RowValues = {
  periodAchievement: string;
  cumulativeAchievement: string;
  comments: string;
  dataSource: string;
};

function initialValues(row: PeriodIndicatorRow): RowValues {
  return {
    periodAchievement: row.update?.periodAchievement ?? "",
    cumulativeAchievement: row.update?.cumulativeAchievement ?? "",
    comments: row.update?.comments ?? "",
    dataSource: row.update?.dataSource ?? (row.dataSource ?? ""),
  };
}

export function IndicatorEntryGrid({
  projectId,
  periodId,
  rows,
  canEdit,
  canVerify,
}: {
  projectId: string;
  periodId: string;
  rows: PeriodIndicatorRow[];
  canEdit: boolean;
  canVerify: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, RowValues>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, initialValues(row)])),
  );
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ rows: Array<{ indicatorId: string | null; code: string; name: string | null; periodAchievement: string; cumulativeAchievement: string; comments: string; dataSource: string; matched: boolean }>; warnings: string[] } | null>(null);

  const grouped = useMemo(() => {
    const groups = new Map<string, PeriodIndicatorRow[]>();
    for (const row of rows) {
      const key = row.logframeLevel ?? "UNASSIGNED";
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    return [...groups.entries()].sort(
      (a, b) =>
        (LEVEL_ORDER.indexOf(a[0]) === -1 ? LEVEL_ORDER.length : LEVEL_ORDER.indexOf(a[0])) -
        (LEVEL_ORDER.indexOf(b[0]) === -1 ? LEVEL_ORDER.length : LEVEL_ORDER.indexOf(b[0])),
    );
  }, [rows]);

  const dirtyCount = dirty.size;

  function updateCell(indicatorId: string, field: keyof RowValues, value: string) {
    setValues((current) => ({ ...current, [indicatorId]: { ...(current[indicatorId] ?? initialValues(rows.find((r) => r.id === indicatorId)!)), [field]: value } }));
    setDirty((current) => new Set(current).add(indicatorId));
  }

  function rowIsVerified(row: PeriodIndicatorRow): boolean {
    return row.update?.verificationStatus === "VERIFIED";
  }

  async function saveAll() {
    if (dirtyCount === 0 || saving) return;
    setSaving(true);
    try {
      const payload: BulkSaveRow[] = rows
        .filter((row) => dirty.has(row.id))
        .map((row) => {
          const v = values[row.id] ?? initialValues(row);
          return {
            indicatorId: row.id,
            periodAchievement: v.periodAchievement,
            cumulativeAchievement: v.cumulativeAchievement,
            comments: v.comments || undefined,
            dataSource: v.dataSource || undefined,
          };
        });
      const result = await bulkSaveIndicatorUpdatesAction(periodId, payload);
      if (!result.ok) {
        toast.push({ title: "Could not save indicator data", description: result.error.message, tone: "danger" });
        return;
      }
      toast.push({
        title: "Indicator data saved",
        description: `${result.value.saved} row${result.value.saved === 1 ? "" : "s"} saved${result.value.skipped ? `, ${result.value.skipped} verified row${result.value.skipped === 1 ? "" : "s"} left unchanged` : ""}.`,
        tone: "success",
      });
      setDirty(new Set());
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function verifyRow(row: PeriodIndicatorRow) {
    if (!row.update || verifyingId) return;
    setVerifyingId(row.update.id);
    try {
      const result = await verifyIndicatorUpdateAction(row.update.id);
      if (!result.ok) {
        toast.push({ title: "Could not verify indicator", description: result.error.message, tone: "danger" });
        return;
      }
      toast.push({ title: "Indicator verified", tone: "success" });
      router.refresh();
    } finally {
      setVerifyingId(null);
    }
  }

  async function loadPreview() {
    if (!sheetUrl.trim() || importing) return;
    setImporting(true);
    setPreview(null);
    try {
      const result = await parseIndicatorSheetAction(periodId, sheetUrl.trim());
      if (!result.ok) {
        toast.push({ title: "Could not read the spreadsheet", description: result.error.message, tone: "danger" });
        return;
      }
      setPreview(result.value);
    } finally {
      setImporting(false);
    }
  }

  function applyPreview() {
    if (!preview) return;
    setValues((current) => {
      const next = { ...current };
      const byId = new Map(rows.map((row) => [row.id, row]));
      for (const parsed of preview.rows) {
        if (!parsed.indicatorId || !byId.has(parsed.indicatorId)) continue;
        const base = next[parsed.indicatorId] ?? initialValues(byId.get(parsed.indicatorId)!);
        next[parsed.indicatorId] = {
          periodAchievement: parsed.periodAchievement || base.periodAchievement,
          cumulativeAchievement: parsed.cumulativeAchievement || base.cumulativeAchievement,
          comments: parsed.comments || base.comments,
          dataSource: parsed.dataSource || base.dataSource,
        };
      }
      return next;
    });
    setDirty((current) => {
      const next = new Set(current);
      for (const parsed of preview.rows) {
        if (parsed.indicatorId && parsed.matched) next.add(parsed.indicatorId);
      }
      return next;
    });
    toast.push({ title: "Spreadsheet applied to the grid", description: "Review the values, then press Save all.", tone: "success" });
    setPreview(null);
    setSheetUrl("");
    setImportOpen(false);
  }

  const matchedRows = preview?.rows.filter((r) => r.matched).length ?? 0;

  return (
    <div className="mt-6 space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Record indicator values for this reporting period</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Values are saved as drafts. Someone with verify permission submits and verifies them, which locks the row against further edits.
            {dirtyCount > 0 && <span className="ml-2 text-xs font-medium text-brand-600 dark:text-brand-400">{dirtyCount} unsaved row{dirtyCount === 1 ? "" : "s"}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => setImportOpen((open) => !open)}>
              Import from Google Sheet
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={saveAll} pending={saving} disabled={dirtyCount === 0}>
              Save all
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => router.push(`/projects/${projectId}/reports/${periodId}`)}>
            Back to report workspace
          </Button>
        </div>
      </div>

      {importOpen && canEdit && (
        <section className="card space-y-3 p-4" aria-label="Import indicator data from Google Sheets">
          <div>
            <p className="text-sm font-medium">Import from Google Sheets</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Paste a Google Sheets link. The sheet must be shared with the connected Google account and have a header row with the indicator code,
              period achievement, and optional cumulative / comments / data source columns.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="max-w-xl"
              aria-label="Google Sheets URL"
            />
            <Button variant="secondary" size="sm" onClick={loadPreview} pending={importing}>
              Load preview
            </Button>
          </div>
          {preview && (
            <div className="space-y-2 text-sm">
              {preview.warnings.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-warning-500/30 bg-warning-500/5 p-3 text-xs text-warning-700 dark:text-warning-400">
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Found {preview.rows.length} data row{preview.rows.length === 1 ? "" : "s"} — {matchedRows} match{matchedRows === 1 ? "" : "es"} a logframe indicator.
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
                <table className="w-full text-xs">
                  <thead className="thead">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Code</th>
                      <th className="px-2 py-1.5 text-left">Indicator</th>
                      <th className="px-2 py-1.5 text-left">Period achievement</th>
                      <th className="px-2 py-1.5 text-left">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 20).map((parsed, index) => (
                      <tr key={`${parsed.code}-${index}`} className="trow">
                        <td className="px-2 py-1.5 font-mono">
                          {parsed.code}
                          {!parsed.matched && <span className="ml-2 text-danger-600 dark:text-danger-400">(no match)</span>}
                        </td>
                        <td className="px-2 py-1.5">{parsed.name ?? "—"}</td>
                        <td className="px-2 py-1.5">{parsed.periodAchievement || "—"}</td>
                        <td className="px-2 py-1.5">{parsed.cumulativeAchievement || "—"}</td>
                      </tr>
                    ))}
                    {preview.rows.length > 20 && (
                      <tr className="trow">
                        <td colSpan={4} className="px-2 py-1.5 text-slate-500">
                          …and {preview.rows.length - 20} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={applyPreview} disabled={matchedRows === 0}>
                  Apply {matchedRows} to grid
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {grouped.length === 0 ? (
        <div className="card text-sm text-slate-600 dark:text-slate-300">
          No indicators defined yet.{" "}
          <a className="font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${projectId}/logframe`}>
            Add indicators to the logframe
          </a>{" "}
          first, then return here to enter their values.
        </div>
      ) : (
        <div className="table-shell overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Indicator values for reporting period {periodId}</caption>
            <thead className="thead">
              <tr>
                <th className="px-3 py-2 text-left">Level</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Indicator</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Baseline</th>
                <th className="px-3 py-2 text-left">Target</th>
                <th className="px-3 py-2 text-left">Period achievement</th>
                <th className="px-3 py-2 text-left">Cumulative</th>
                <th className="px-3 py-2 text-left">Comments</th>
                <th className="px-3 py-2 text-left">Data source</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(([level, levelRows]) => (
                <LevelGroupRows
                  key={level}
                  level={level}
                  rows={levelRows}
                  values={values}
                  dirty={dirty}
                  canEdit={canEdit}
                  canVerify={canVerify}
                  verifyingId={verifyingId}
                  onChange={updateCell}
                  onVerify={verifyRow}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LevelGroupRows({
  level,
  rows,
  values,
  dirty,
  canEdit,
  canVerify,
  verifyingId,
  onChange,
  onVerify,
}: {
  level: string;
  rows: PeriodIndicatorRow[];
  values: Record<string, RowValues>;
  dirty: Set<string>;
  canEdit: boolean;
  canVerify: boolean;
  verifyingId: string | null;
  onChange: (indicatorId: string, field: keyof RowValues, value: string) => void;
  onVerify: (row: PeriodIndicatorRow) => void;
}) {
  return (
    <>
      {rows.map((row) => {
        const verified = row.update?.verificationStatus === "VERIFIED";
        const editable = canEdit && !verified;
        const v = values[row.id] ?? initialValues(row);
        const target = row.target ? `${row.target}${row.unit ? ` ${row.unit}` : ""}` : "—";
        return (
          <tr key={row.id} className={`trow ${dirty.has(row.id) ? "bg-brand-500/5" : ""}`}>
            <td className="px-3 py-2">
              {level === "UNASSIGNED" ? "—" : <Badge tone={levelTone(level)}>{LOGFRAME_LEVEL_LABEL[level] ?? level}</Badge>}
            </td>
            <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
            <td className="min-w-[200px] px-3 py-2">
              <span className="font-medium">{row.name}</span>
              {row.logframeTitle && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{row.logframeTitle}</span>}
            </td>
            <td className="px-3 py-2 text-xs">{INDICATOR_TYPE_LABEL[row.type] ?? row.type}</td>
            <td className="px-3 py-2 text-xs">{row.baseline || "—"}</td>
            <td className="px-3 py-2 text-xs">{target}</td>
            <td className="min-w-[140px] px-3 py-2">
              {row.type === "YES_NO" ? (
                <Select
                  value={v.periodAchievement}
                  onChange={(e) => onChange(row.id, "periodAchievement", e.target.value)}
                  disabled={!editable}
                  aria-label={`Period achievement for ${row.code}`}
                  className="min-h-[38px]"
                >
                  <option value="">—</option>
                  <option value="YES">Yes</option>
                  <option value="NO">No</option>
                </Select>
              ) : (
                <Input
                  value={v.periodAchievement}
                  onChange={(e) => onChange(row.id, "periodAchievement", e.target.value)}
                  disabled={!editable}
                  placeholder={row.unit ? `e.g. value in ${row.unit}` : "Value"}
                  className="min-h-[38px] px-2 py-1 text-xs"
                  aria-label={`Period achievement for ${row.code}`}
                />
              )}
            </td>
            <td className="min-w-[120px] px-3 py-2">
              <Input
                value={v.cumulativeAchievement}
                onChange={(e) => onChange(row.id, "cumulativeAchievement", e.target.value)}
                disabled={!editable}
                placeholder="Running total"
                className="min-h-[38px] px-2 py-1 text-xs"
                aria-label={`Cumulative achievement for ${row.code}`}
              />
            </td>
            <td className="min-w-[160px] px-3 py-2">
              <Input
                value={v.comments}
                onChange={(e) => onChange(row.id, "comments", e.target.value)}
                disabled={!editable}
                placeholder="Notes"
                className="min-h-[38px] px-2 py-1 text-xs"
                aria-label={`Comments for ${row.code}`}
              />
            </td>
            <td className="min-w-[160px] px-3 py-2">
              <Input
                value={v.dataSource}
                onChange={(e) => onChange(row.id, "dataSource", e.target.value)}
                disabled={!editable}
                placeholder="Source of the figure"
                className="min-h-[38px] px-2 py-1 text-xs"
                aria-label={`Data source for ${row.code}`}
              />
            </td>
            <td className="px-3 py-2">
              {row.update ? (
                <Badge tone={indicatorVerificationTone(row.update.verificationStatus)}>
                  {INDICATOR_VERIFICATION_LABEL[row.update.verificationStatus] ?? row.update.verificationStatus}
                </Badge>
              ) : (
                <span className="text-xs text-slate-400">Not entered</span>
              )}
            </td>
            <td className="px-3 py-2">
              {canVerify && row.update && !verified && (
                <Button variant="secondary" size="sm" pending={verifyingId === row.update.id} onClick={() => onVerify(row)}>
                  Submit & verify
                </Button>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function levelTone(level: string): "info" | "success" | "warning" | "neutral" {
  switch (level) {
    case "GOAL":
      return "info";
    case "OUTCOME":
      return "success";
    case "OUTPUT":
      return "warning";
    default:
      return "neutral";
  }
}
