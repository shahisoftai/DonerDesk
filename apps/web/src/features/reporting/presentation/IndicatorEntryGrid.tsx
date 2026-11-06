"use client";

import Link from "next/link";
import { collectionText } from "@/features/tasks/domain/collection-view";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nextRunningTotal } from "@donordesk/domain/contexts/logframe/indicator-entry-suggestions.js";
import type { DisaggregationEntryInput } from "@donordesk/contracts";
import { useRouter } from "next/navigation";
import {
  bulkSaveIndicatorUpdatesAction,
  parseIndicatorSheetAction,
  parseIndicatorWorkbookAction,
  verifyIndicatorUpdateAction,
  verifyAllIndicatorUpdatesAction,
  submitAllIndicatorUpdatesAction,
  returnAllIndicatorUpdatesAction,
  reopenIndicatorUpdatesAction,
  setEntryWindowAction,
  type BulkSaveRow,
} from "@/lib/actions/indicators";
import type { PeriodIndicatorRow } from "@/lib/server/schemas";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/data/Badge";
import { useToast } from "@/components/feedback/Toast";
import { indicatorVerificationTone } from "@/lib/shared/tone";
import { INDICATOR_VERIFICATION_LABEL, INDICATOR_TYPE_LABEL, LOGFRAME_LEVEL_LABEL } from "@/lib/labels";
import { logframeLevelRank, logframeLevelTone } from "@/features/logframe/domain/logframe-outline";
import { DisaggregationEditor } from "@/features/logframe/presentation/DisaggregationEditor";
import { EntrySheet, type AutosaveStatus } from "@/features/reporting/presentation/EntrySheet";
import { toSheetRow } from "@/features/reporting/presentation/sheet-rows";
import { applyChanges, changedRowIds, defaultSheetPrefs, parseSheetPrefs, summarise, toWritePlan, type Change, type SheetPrefs, type ValuesById } from "@/features/reporting/domain/entry-sheet";
import { useOutbox } from "@/features/offline/presentation/OutboxProvider";
import { indicatorValuesEntry } from "@/features/offline/domain/indicator-values-outbox";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

const VIEW_KEY = "dd-entry-view";
const PREFS_KEY = "dd-entry-sheet-prefs";
type EntryView = "sheet" | "form";

type TextField = "periodAchievement" | "cumulativeAchievement" | "comments" | "dataSource" | "notApplicableReason";

type RowValues = Record<TextField, string> & { disaggregation: DisaggregationEntryInput[] };

const COLUMN_COUNT = 12;

function initialValues(row: PeriodIndicatorRow): RowValues {
  return {
    periodAchievement: row.update?.periodAchievement ?? "",
    cumulativeAchievement: row.update?.cumulativeAchievement ?? "",
    comments: row.update?.comments ?? "",
    notApplicableReason: row.update?.notApplicableReason ?? "",
    // The source typed for this indicator last period carries forward; else the indicator's own definition.
    dataSource: row.update?.dataSource ?? row.previous?.dataSource ?? row.dataSource ?? "",
    disaggregation: row.update?.disaggregation ?? [],
  };
}

function hasBreakdown(row: PeriodIndicatorRow, values: RowValues): boolean {
  return row.disaggregationRequired || values.disaggregation.length > 0;
}

export function IndicatorEntryGrid({
  projectId,
  periodId,
  rows,
  reportType,
  canEdit,
  canVerify,
  today,
  userId,
  names = {},
  canAsk = false,
  dataStatus,
  entryWindow,
  canManageWindow = false,
  history,
  places,
  simpleReview = false,
}: {
  projectId: string;
  periodId: string;
  rows: PeriodIndicatorRow[];
  /** Lets the empty state say why there is nothing to enter. */
  reportType?: string;
  canEdit: boolean;
  canVerify: boolean;
  /** For "Due by 5 Nov · Amina" beside a row that is waiting for a value. */
  today?: string;
  userId?: string;
  names?: Record<string, string>;
  /** May this person ask someone for the value (links to the indicator, where the request is made). */
  canAsk?: boolean;
  /** Where the period's data stands (derived by the server from the values' statuses). */
  dataStatus?: { status: string; description: string };
  /** When the people who enter values may do so; `refusal` is set when this person may not right now. */
  entryWindow?: { opensOn?: string | undefined; closesOn?: string | undefined; description: string | null; refusal: string | null };
  /** May this person set the window (project editors). */
  canManageWindow?: boolean;
  /** Earlier periods' period values (read-only columns in the sheet). */
  history?: { periods: Array<{ id: string; label: string }>; values: Record<string, Record<string, string>> };
  /** Place names the project knows, offered by place in the sheet. */
  places?: string[];
  /** The project hands a value in as soon as it is saved with Save all (autosave still only keeps drafts). */
  simpleReview?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  // The sheet is the default on a wide screen; the form is always used on a narrow one. The choice is kept in this browser only.
  const [view, setView] = useState<EntryView>("sheet");
  const [wide, setWide] = useState(true);
  useEffect(() => {
    try { const stored = window.localStorage.getItem(VIEW_KEY); if (stored === "sheet" || stored === "form") setView(stored); } catch { /* the default applies */ }
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  function chooseView(next: EntryView) {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* not kept; still applies now */ }
  }
  const outbox = useOutbox();
  const [prefs, setPrefsState] = useState<SheetPrefs>(defaultSheetPrefs);
  useEffect(() => { try { setPrefsState(parseSheetPrefs(window.localStorage.getItem(PREFS_KEY))); } catch { /* the defaults apply */ } }, []);
  const setPrefs = useCallback((next: SheetPrefs) => {
    setPrefsState(next);
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* kept for this visit only */ }
  }, []);
  const [autosave, setAutosave] = useState<AutosaveStatus>({ state: "idle" });
  const [values, setValues] = useState<Record<string, RowValues>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, initialValues(row)])),
  );
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /** Rows where the person has chosen "Not applicable" but not yet given the reason. */
  const [naOpen, setNaOpen] = useState<Set<string>>(new Set());

  const [importOpen, setImportOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ rows: Array<{ indicatorId: string | null; code: string; name: string | null; periodAchievement: string; cumulativeAchievement: string; comments: string; dataSource: string; matched: boolean; locked?: boolean }>; warnings: string[] } | null>(null);

  const grouped = useMemo(() => {
    const groups = new Map<string, PeriodIndicatorRow[]>();
    for (const row of rows) {
      const key = row.logframeLevel ?? "UNASSIGNED";
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    return [...groups.entries()].sort((a, b) => logframeLevelRank(a[0]) - logframeLevelRank(b[0]));
  }, [rows]);

  const dirtyCount = dirty.size;

  /** What the server last had for each row: the sheet tells what is unsaved by comparing with it. */
  const initialById = useMemo(() => Object.fromEntries(rows.map((row) => [row.id, initialValues(row)])), [rows]);
  const orderedRows = useMemo(() => grouped.flatMap(([, levelRows]) => levelRows), [grouped]);

  /** The latest values, so two changes made in one tick (a paste, then a fill) build on each other. */
  const valuesRef = useRef(values);
  valuesRef.current = values;

  /** Typed, pasted, filled, cleared or undone in the sheet: one entry, applied to the same values and unsaved set the form uses. */
  const applySheetChanges = useCallback((changes: Change[]) => {
    const next = applyChanges(valuesRef.current as ValuesById, changes) as Record<string, RowValues>;
    valuesRef.current = next;
    setValues(next);
    const changed = changedRowIds(initialById as ValuesById, next as ValuesById);
    const touched = new Set(changes.map((c) => c.rowId));
    // A row that came in some other way (an import preview) stays unsaved; a row the sheet put back to what it was is clean again.
    setDirty((d) => {
      const merged = new Set([...d].filter((id) => !touched.has(id)));
      for (const id of touched) if (changed.has(id)) merged.add(id);
      return merged;
    });
  }, [initialById]);
  const applyBreakdown = (rowId: string, entries: RowValues["disaggregation"]) => updateRow(rowId, { disaggregation: entries });
  const showSheet = view === "sheet" && wide;

  // ----- Automatic save for the sheet: drafts only (nothing is handed in or verified by it), through the same write plan as Save all. -----
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const allSheetRows = useMemo(() => rows.map(toSheetRow), [rows]);
  const refreshPending = useRef(false);
  const lastQueued = useRef("");
  const lastFailed = useRef("");
  useEffect(() => { refreshPending.current = false; }, [rows]);

  const queueOffline = useCallback(async (payload: ReturnType<typeof toWritePlan>) => {
    const key = JSON.stringify(payload);
    if (key !== lastQueued.current) {
      await outbox.enqueue(indicatorValuesEntry({ id: crypto.randomUUID(), title: `Indicator values (${payload.length})`, payload: { periodId, rows: payload as unknown as Array<Record<string, unknown>> }, now: Date.now() }));
      lastQueued.current = key;
    }
    setAutosave({ state: "queued" });
  }, [outbox, periodId]);

  const autosaveNow = useCallback(async () => {
    const snapshot = valuesRef.current as ValuesById<DisaggregationEntryInput>;
    const payload = toWritePlan(allSheetRows, snapshot, dirtyRef.current);
    if (payload.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { await queueOffline(payload); return; }
    setAutosave({ state: "saving" });
    const result = await bulkSaveIndicatorUpdatesAction(periodId, payload as BulkSaveRow[]);
    if (!result.ok) {
      if (result.error.kind === "unavailable") { await queueOffline(payload); return; }
      lastFailed.current = JSON.stringify(payload);
      setAutosave({ state: "failed", message: result.error.message });
      return;
    }
    refreshPending.current = true;
    // Rows the person kept editing while this saved stay unsaved; the rest are clean.
    setDirty(changedRowIds(snapshot as ValuesById, valuesRef.current as ValuesById));
    setAutosave({ state: "saved", at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    router.refresh();
    window.setTimeout(() => { refreshPending.current = false; }, 4000);
  }, [allSheetRows, periodId, queueOffline, router]);

  useEffect(() => {
    if (!showSheet || !prefs.autosave || !canEdit) return;
    if (dirty.size === 0) { setAutosave((s) => (s.state === "pending" || s.state === "error" ? { state: "idle" } : s)); return; }
    const summary = summarise(allSheetRows, values as ValuesById, initialById as ValuesById, { canEdit, closedReason: entryWindow?.refusal ?? null });
    if (summary.invalidCells > 0) { setAutosave((s) => (s.state === "error" ? s : { state: "error" })); return; }
    if (saving || refreshPending.current) return;
    // The same save that already failed is not tried again until something changes.
    if (JSON.stringify(toWritePlan(allSheetRows, values as ValuesById<DisaggregationEntryInput>, dirty)) === lastFailed.current) return;
    // Only a change of state sets state: this effect runs on every keystroke and must never set a new object when nothing changed.
    setAutosave((s) => (s.state === "queued" || s.state === "pending" ? s : { state: "pending" }));
    const timer = window.setTimeout(() => { void autosaveNow(); }, 2500);
    return () => window.clearTimeout(timer);
  }, [dirty, values, rows, prefs.autosave, showSheet, canEdit, saving, allSheetRows, initialById, entryWindow?.refusal, autosaveNow]);

  // A save queued while offline is sent by the outbox when the connection returns; show what it did.
  useEffect(() => {
    if (autosave.state !== "queued") return;
    const onOnline = () => window.setTimeout(() => router.refresh(), 5000);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [autosave.state, router]);

  const fileInput = useRef<HTMLInputElement>(null);
  async function importWorkbook(file: File | undefined) {
    if (!file || importing) return;
    setImporting(true);
    setPreview(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const result = await parseIndicatorWorkbookAction(periodId, form);
      if (!result.ok) {
        toast.push({ title: "Could not read the Excel file", description: result.error.message, tone: "danger" });
        return;
      }
      setPreview(result.value);
      setImportOpen(true);
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  /** The running total last suggested per row, so a person's own entry is never replaced by a newer suggestion. */
  const lastSuggestion = useRef<Record<string, string | undefined>>({});

  function updateRow(indicatorId: string, patch: Partial<RowValues>) {
    const row = rows.find((r) => r.id === indicatorId)!;
    // Computed from the current snapshot (not inside the state updater) so the suggestion bookkeeping runs exactly once.
    const before = values[indicatorId] ?? initialValues(row);
    const merged = { ...before, ...patch };
    if (patch.periodAchievement !== undefined && patch.cumulativeAchievement === undefined) {
      const next = nextRunningTotal({
        aggregation: row.aggregation,
        periodValue: merged.periodAchievement,
        currentCumulative: before.cumulativeAchievement,
        previousCumulative: row.previous?.cumulativeAchievement,
        lastSuggestion: lastSuggestion.current[indicatorId],
      });
      lastSuggestion.current[indicatorId] = next.suggestion;
      merged.cumulativeAchievement = next.cumulative;
    }
    setValues((current) => ({ ...current, [indicatorId]: merged }));
    setDirty((current) => new Set(current).add(indicatorId));
  }

  function toggleBreakdown(indicatorId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(indicatorId)) next.delete(indicatorId);
      else next.add(indicatorId);
      return next;
    });
  }

  function rowIsVerified(row: PeriodIndicatorRow): boolean {
    return row.update?.verificationStatus === "VERIFIED";
  }

  /** Rows that hold a value but are not verified yet (what "Verify all" would act on). */
  const unverifiedCount = rows.filter((row) => row.update && row.update.verificationStatus !== "VERIFIED").length;
  const [verifyingAll, setVerifyingAll] = useState(false);
  /** Values the person can hand in: drafts and returned values that hold a figure (a calculated indicator has none of its own). */
  const submittableCount = rows.filter((row) => !row.calculation && row.update && (row.update.verificationStatus === "DRAFT" || row.update.verificationStatus === "NEEDS_CORRECTION") && (row.update.notApplicableReason || row.update.periodAchievement.trim() !== "" || row.update.cumulativeAchievement.trim() !== "")).length;
  const [submittingAll, setSubmittingAll] = useState(false);
  const waitingCount = rows.filter((row) => row.update?.verificationStatus === "SUBMITTED").length;
  const verifiedCount = rows.filter((row) => row.update?.verificationStatus === "VERIFIED").length;
  const [windowOpen, setWindowOpen] = useState(false);
  const [opensOn, setOpensOn] = useState(entryWindow?.opensOn ?? "");
  const [closesOn, setClosesOn] = useState(entryWindow?.closesOn ?? "");
  const [savingWindow, setSavingWindow] = useState(false);

  async function saveWindow() {
    setSavingWindow(true);
    try {
      const result = await setEntryWindowAction(periodId, opensOn, closesOn);
      if (!result.ok) {
        toast.push({ title: "Could not save the entry window", description: result.error.message, tone: "danger" });
        return;
      }
      toast.push({ title: result.value.description ?? "Entry window cleared", tone: "success" });
      setWindowOpen(false);
      router.refresh();
    } finally {
      setSavingWindow(false);
    }
  }
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returning, setReturning] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);

  async function reopenVerified() {
    setReopening(true);
    try {
      const result = await reopenIndicatorUpdatesAction(periodId, reopenReason);
      if (!result.ok) {
        toast.push({
          title: "Could not reopen the verified values",
          description: `${result.error.message} If the report was approved, reopen the report first (Reports, then Reopen), then reopen the values.`,
          tone: "danger",
          durationMs: 15000,
        });
        return;
      }
      toast.push({ title: `${result.value.returned} verified value${result.value.returned === 1 ? "" : "s"} reopened`, description: "They are marked as needing correction. Edit them, save, submit and verify again.", tone: "success", durationMs: 10000 });
      setReopenOpen(false);
      setReopenReason("");
      router.refresh();
    } finally {
      setReopening(false);
    }
  }

  async function returnAll() {
    setReturning(true);
    try {
      const result = await returnAllIndicatorUpdatesAction(periodId, returnReason);
      if (!result.ok) {
        toast.push({ title: "Could not send back", description: result.error.message, tone: "danger" });
        return;
      }
      toast.push({ title: `${result.value.returned} indicator value${result.value.returned === 1 ? "" : "s"} sent back`, tone: "success" });
      setReturnOpen(false);
      setReturnReason("");
      router.refresh();
    } finally {
      setReturning(false);
    }
  }

  async function submitAll() {
    setSubmittingAll(true);
    try {
      const result = await submitAllIndicatorUpdatesAction(periodId);
      if (!result.ok) {
        toast.push({ title: "Could not submit", description: result.error.message, tone: "danger" });
        return;
      }
      const { submitted, failed } = result.value;
      toast.push(failed.length > 0
        ? { title: `${submitted} submitted, ${failed.length} could not be submitted`, description: failed.map((f) => `${f.indicatorCode}: ${f.message}`).join(" · "), tone: "warning" }
        : { title: `${submitted} indicator value${submitted === 1 ? "" : "s"} submitted for review`, tone: "success" });
      router.refresh();
    } finally {
      setSubmittingAll(false);
    }
  }

  async function verifyAll(updateIds?: string[]) {
    setVerifyingAll(true);
    try {
      const result = await verifyAllIndicatorUpdatesAction(periodId, updateIds);
      if (!result.ok) {
        toast.push({ title: "Could not verify", description: result.error.message, tone: "danger" });
        return;
      }
      const { verified, failed } = result.value;
      if (failed.length > 0) {
        const needFile = failed.filter((f) => f.message.startsWith("Attach a file that proves"));
        const others = failed.filter((f) => !needFile.includes(f));
        const parts = [
          needFile.length > 0
            ? `${needFile.map((f) => f.indicatorCode).join(", ")} ${needFile.length === 1 ? "has" : "have"} no file behind ${needFile.length === 1 ? "it" : "them"}. This project requires one before a value is verified. Open Evidence, link a verified file to ${needFile.length === 1 ? "the value" : "each value"}, then verify again.`
            : "",
          ...others.map((f) => `${f.indicatorCode}: ${f.message}`),
        ].filter(Boolean);
        toast.push({
          title: `${verified} verified, ${failed.length} could not be verified`,
          description: parts.join(" "),
          tone: "warning",
          durationMs: 20000,
          action: needFile.length > 0 ? { label: "Open evidence", onAction: () => router.push(`/projects/${projectId}/evidence`) } : undefined,
        });
      } else {
        toast.push({ title: `${verified} indicator value${verified === 1 ? "" : "s"} verified`, tone: "success" });
      }
      router.refresh();
    } finally {
      setVerifyingAll(false);
    }
  }

  async function saveAll(thenVerify = false) {
    if ((dirtyCount === 0 && !thenVerify) || saving) return;
    setSaving(true);
    try {
      if (dirtyCount === 0) {
        await verifyAll();
        return;
      }
      // The same write plan the sheet's automatic save uses: the version each row was saved against, "" clears, a reason makes the
      // row "not applicable" and its figures are ignored, a breakdown only when required or typed.
      const payload = toWritePlan(rows.map(toSheetRow), values as ValuesById<DisaggregationEntryInput>, dirty) as BulkSaveRow[];
      const result = await bulkSaveIndicatorUpdatesAction(periodId, payload, { handIn: true });
      if (!result.ok) {
        toast.push({ title: "Could not save indicator data", description: result.error.message, tone: "danger" });
        return;
      }
      toast.push({
        title: "Indicator data saved",
        description: [`${result.value.saved} row${result.value.saved === 1 ? "" : "s"} saved${result.value.skipped ? `, ${result.value.skipped} verified row${result.value.skipped === 1 ? "" : "s"} left unchanged` : ""}.`, ...result.value.notices].join(" "),
        tone: "success",
      });
      setDirty(new Set());
      if (thenVerify) {
        // Every unverified value of the period, including the rows just written (their ids came back with the save).
        await verifyAll();
        return;
      }
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
        if (!parsed.indicatorId || !byId.has(parsed.indicatorId) || parsed.locked) continue;
        const base = next[parsed.indicatorId] ?? initialValues(byId.get(parsed.indicatorId)!);
        next[parsed.indicatorId] = {
          periodAchievement: parsed.periodAchievement || base.periodAchievement,
          cumulativeAchievement: parsed.cumulativeAchievement || base.cumulativeAchievement,
          comments: parsed.comments || base.comments,
          dataSource: parsed.dataSource || base.dataSource,
          notApplicableReason: base.notApplicableReason,
          disaggregation: base.disaggregation,
        };
      }
      return next;
    });
    setDirty((current) => {
      const next = new Set(current);
      for (const parsed of preview.rows) {
        if (parsed.indicatorId && parsed.matched && !parsed.locked) next.add(parsed.indicatorId);
      }
      return next;
    });
    toast.push({ title: t("sheet.excel.applied"), description: t("sheet.excel.locked"), tone: "success" });
    setPreview(null);
    setSheetUrl("");
    setImportOpen(false);
  }

  const matchedRows = preview?.rows.filter((r) => r.matched && !r.locked).length ?? 0;

  return (
    <div className="mt-6 space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Record indicator values for this reporting period</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {dataStatus?.description ?? "Values are saved as drafts. Submit them for review when they are complete; a reviewer verifies them, which locks the row against further edits."}
            {dirtyCount > 0 && <span className="ml-2 text-xs font-medium text-brand-600 dark:text-brand-400">{dirtyCount} unsaved row{dirtyCount === 1 ? "" : "s"}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary px-3 py-1.5 text-sm" href={`/api/reporting-periods/${periodId}/indicator-sheet/export`}>{t("sheet.excel.download")}</a>
          {canEdit && (
            <>
              <input ref={fileInput} type="file" accept=".xlsx" className="sr-only" aria-label={t("sheet.excel.import")} onChange={(e) => void importWorkbook(e.target.files?.[0])} />
              <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()} pending={importing}>{t("sheet.excel.import")}</Button>
            </>
          )}
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => setImportOpen((open) => !open)}>
              Import from Google Sheet
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => void saveAll()} pending={saving} disabled={dirtyCount === 0} title={simpleReview ? "This project hands values in when you save them" : undefined}>
              {simpleReview ? "Save and hand in" : "Save all"}
            </Button>
          )}
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => void submitAll()} pending={submittingAll} disabled={dirtyCount > 0 || submittableCount === 0} title={dirtyCount > 0 ? "Save your changes first" : undefined}>
              Submit for review{submittableCount > 0 ? ` (${submittableCount})` : ""}
            </Button>
          )}
          {canVerify && waitingCount > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setReturnOpen((open) => !open)}>
              Send back ({waitingCount})
            </Button>
          )}
          {canVerify && verifiedCount > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setReopenOpen((open) => !open)}>
              Reopen verified ({verifiedCount})
            </Button>
          )}
          {canEdit && canVerify && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void saveAll(true)}
              pending={saving || verifyingAll}
              disabled={dirtyCount === 0 && unverifiedCount === 0}
            >
              {dirtyCount > 0 ? "Save & verify all" : `Verify all (${unverifiedCount})`}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => router.push(`/projects/${projectId}/reports/${periodId}`)}>
            Back to report workspace
          </Button>
        </div>
      </div>

      {(entryWindow?.description || canManageWindow) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          <span>{entryWindow?.description ?? "Entry has no opening or closing day."}</span>
          {canManageWindow && <button type="button" className="font-medium text-brand-700 underline dark:text-brand-300" onClick={() => setWindowOpen((o) => !o)}>{windowOpen ? "Close" : "Change the entry window"}</button>}
        </div>
      )}
      {entryWindow?.refusal && <InlineAlert tone="warning" title="You cannot enter values right now">{entryWindow.refusal}</InlineAlert>}
      {windowOpen && canManageWindow && (
        <section className="card grid gap-3 p-4 sm:grid-cols-3" aria-label="Entry window">
          <Field label="Opens on" htmlFor="entry-opens"><Input id="entry-opens" type="date" value={opensOn} onChange={(e) => setOpensOn(e.target.value)} disabled={savingWindow} /></Field>
          <Field label="Closes on" htmlFor="entry-closes"><Input id="entry-closes" type="date" value={closesOn} onChange={(e) => setClosesOn(e.target.value)} disabled={savingWindow} /></Field>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={() => void saveWindow()} pending={savingWindow}>Save</Button>
            <Button size="sm" variant="secondary" onClick={() => { setOpensOn(""); setClosesOn(""); }} disabled={savingWindow}>Clear dates</Button>
          </div>
          <p className="text-xs text-slate-500 sm:col-span-3 dark:text-slate-400">Outside these days the people who enter values cannot save or submit them. Reviewers can always enter or change values.</p>
        </section>
      )}
      {reopenOpen && canVerify && (
        <section className="card space-y-3 p-4" aria-label="Reopen verified values">
          <p className="text-sm font-medium">Reopen {verifiedCount} verified value{verifiedCount === 1 ? "" : "s"}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Every verified value of this period goes back to "needs correction" with this reason, so it can be edited. It has to be verified again afterwards. Not possible once the report is approved.</p>
          <Textarea rows={3} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} aria-label="Why the values are being reopened" disabled={reopening} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void reopenVerified()} pending={reopening} disabled={reopenReason.trim() === ""}>Reopen</Button>
            <Button size="sm" variant="secondary" onClick={() => setReopenOpen(false)} disabled={reopening}>Cancel</Button>
          </div>
        </section>
      )}
      {returnOpen && canVerify && (
        <section className="card space-y-3 p-4" aria-label="Send values back">
          <p className="text-sm font-medium">Send {waitingCount} value{waitingCount === 1 ? "" : "s"} back for changes</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Every value waiting for review is returned with this reason. The people who entered them are told; verified values stay as they are.</p>
          <Textarea rows={3} value={returnReason} onChange={(e) => setReturnReason(e.target.value)} aria-label="What needs to change" disabled={returning} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void returnAll()} pending={returning} disabled={returnReason.trim() === ""}>Send back</Button>
            <Button size="sm" variant="secondary" onClick={() => setReturnOpen(false)} disabled={returning}>Cancel</Button>
          </div>
        </section>
      )}

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
                          {parsed.locked && <span className="ml-2 text-slate-500">(locked, not applied)</span>}
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

      {grouped.length > 0 && wide && (
        <div className="flex items-center gap-2 text-xs" role="group" aria-label={t("sheet.view.label")}>
          <span className="text-slate-500 dark:text-slate-400">{t("sheet.view.label")}</span>
          {(["sheet", "form"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => chooseView(v)} className={`rounded-full border px-3 py-1 font-medium ${view === v ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"}`}>
              {t(v === "sheet" ? "sheet.view.sheet" : "sheet.view.form")}
            </button>
          ))}
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="card text-sm text-slate-600 dark:text-slate-300">
          {reportType === "SITUATION" ? (
            <>A situation report describes an event and the response, so it takes no indicator values. Enter indicator data in the regular reports (monthly, quarterly, final).</>
          ) : reportType === "ACTIVITY" ? (
            <>An activity report only uses the indicators its own activities feed. Link an activity to an indicator, or enter values in a regular report.</>
          ) : (<>
          No indicators defined yet.{" "}
          <a className="font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${projectId}/logframe`}>
            Add indicators to the logframe
          </a>{" "}
          first, then return here to enter their values.
          </>)}
        </div>
      ) : showSheet ? (
        <EntrySheet
          rows={orderedRows}
          values={values}
          initial={initialById}
          canEdit={canEdit}
          closedReason={entryWindow?.refusal ?? null}
          today={today}
          userId={userId}
          names={names}
          canAsk={canAsk}
          projectId={projectId}
          onChanges={applySheetChanges}
          onBreakdown={applyBreakdown}
          prefs={prefs}
          onPrefs={setPrefs}
          history={history}
          places={places}
          canVerify={canVerify}
          onVerifySelected={(ids) => void verifyAll(ids)}
          verifying={verifyingAll}
          autosave={autosave}
        />
      ) : (
        <div className="table-shell overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Indicator values for this reporting period</caption>
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
                  expanded={expanded}
                  onChange={updateRow}
                  onToggleBreakdown={toggleBreakdown}
                  naOpen={naOpen}
                  onToggleNa={(id, on) => setNaOpen((c) => { const n = new Set(c); if (on) n.add(id); else n.delete(id); return n; })}
                  onVerify={verifyRow}
                  context={{ today, userId: userId ?? "", names, canAsk, projectId }}
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
  expanded,
  onChange,
  onToggleBreakdown,
  naOpen,
  onToggleNa,
  onVerify,
  context,
}: {
  level: string;
  rows: PeriodIndicatorRow[];
  values: Record<string, RowValues>;
  dirty: Set<string>;
  canEdit: boolean;
  canVerify: boolean;
  verifyingId: string | null;
  expanded: Set<string>;
  onChange: (indicatorId: string, patch: Partial<RowValues>) => void;
  onToggleBreakdown: (indicatorId: string) => void;
  /** Rows where "Not applicable" was chosen and the reason is still being typed. */
  naOpen: Set<string>;
  onToggleNa: (indicatorId: string, on: boolean) => void;
  /** For the words beside a row that is waiting for a value. */
  context: { today?: string | undefined; userId: string; names: Record<string, string>; canAsk: boolean; projectId: string };
  onVerify: (row: PeriodIndicatorRow) => void;
}) {
  return (
    <>
      {rows.map((row) => {
        const verified = row.update?.verificationStatus === "VERIFIED";
        const editable = canEdit && !verified && !row.calculation;
        const v = values[row.id] ?? initialValues(row);
        const target = row.target ? `${row.target}${row.unit ? ` ${row.unit}` : ""}` : "—";
        const showBreakdown = hasBreakdown(row, v) && !v.notApplicableReason.trim();
        const notApplicable = v.notApplicableReason.trim() !== "" || naOpen.has(row.id);
        const open = expanded.has(row.id);
        return (
          <Fragment key={row.id}>
            <tr className={`trow ${dirty.has(row.id) ? "bg-brand-500/5" : ""}`}>
              <td className="px-3 py-2">
                {level === "UNASSIGNED" ? "—" : <Badge tone={logframeLevelTone(level)}>{LOGFRAME_LEVEL_LABEL[level] ?? level}</Badge>}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
              <td className="min-w-[200px] px-3 py-2">
                <span className="font-medium">{row.name}</span>
                {row.logframeTitle && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{row.logframeTitle}</span>}
                {row.calculation && <span className="mt-1 block text-xs italic text-slate-600 dark:text-slate-300">{row.calculation}. Worked out from the values recorded for those indicators; see it in the Data Center.</span>}
                {row.dueThisPeriod === false && (
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    Not due this period{row.frequency ? ` (measured ${row.frequency.toLowerCase()})` : ""}. Leave it empty; it is not reported as 0.
                  </span>
                )}
                {context.today && collectionText(row.collection, context.today, context.userId, context.names) && (
                  <span className={`mt-1 block text-xs ${row.collection?.state === "OVERDUE" ? "font-medium text-danger-600" : "text-slate-600 dark:text-slate-300"}`}>
                    {collectionText(row.collection, context.today!, context.userId, context.names)}
                    {context.canAsk && (row.collection?.state === "DUE" || row.collection?.state === "OVERDUE") && (
                      <> · <Link className="underline" href={`/projects/${context.projectId}/indicators/${row.id}`}>Ask for this value</Link></>
                    )}
                  </span>
                )}
                {row.participantsHint && <span role="status" className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{row.participantsHint}</span>}
                {row.requiresDenominator && (
                  <span className="mt-1 block text-xs text-warning-700 dark:text-warning-400">
                    This percentage/ratio indicator has no denominator indicator configured, so its result cannot be independently verified in the report.
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-xs">{INDICATOR_TYPE_LABEL[row.type] ?? row.type}</td>
              <td className="px-3 py-2 text-xs">{row.baseline || "—"}</td>
              <td className="px-3 py-2 text-xs">
                {target}
                {row.stoplight && row.stoplight.light !== "NONE" && (
                  <span title={row.stoplight.note} className={`mt-1 flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${row.stoplight.light === "MET" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"}`}>
                    <span aria-hidden className={`h-2 w-2 rounded-full ${row.stoplight.light === "MET" ? "bg-emerald-500" : "bg-amber-500"}`} />
                    {row.stoplight.light === "MET" ? "Target met" : "Below target"}{row.stoplight.variance ? ` (${row.stoplight.variance})` : ""}
                  </span>
                )}
                {row.stoplight?.light === "NONE" && <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400" title={row.stoplight.note}>Not judged</span>}
              </td>
              <td className="min-w-[140px] px-3 py-2">
                {row.type === "YES_NO" ? (
                  <Select
                    value={v.periodAchievement}
                    onChange={(e) => onChange(row.id, { periodAchievement: e.target.value })}
                    disabled={!editable || notApplicable}
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
                    onChange={(e) => onChange(row.id, { periodAchievement: e.target.value })}
                    disabled={!editable || notApplicable}
                    placeholder={row.unit ? `e.g. value in ${row.unit}` : "Value"}
                    className="min-h-[38px] px-2 py-1 text-xs"
                    aria-label={`Period achievement for ${row.code}`}
                  />
                )}
                {editable && !row.calculation && (
                  notApplicable ? (
                    <div className="mt-1">
                      <Input
                        value={v.notApplicableReason}
                        onChange={(e) => onChange(row.id, { notApplicableReason: e.target.value })}
                        placeholder="Why it does not apply this period"
                        className="min-h-[34px] px-2 py-1 text-xs"
                        aria-label={`Reason ${row.code} is not applicable`}
                      />
                      <button
                        type="button"
                        className="mt-1 block text-xs text-brand-600 hover:underline dark:text-brand-400"
                        onClick={() => {
                          onChange(row.id, { notApplicableReason: "" });
                          onToggleNa(row.id, false);
                        }}
                      >
                        It applies after all
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="mt-1 block text-xs text-slate-600 hover:underline dark:text-slate-300" onClick={() => onToggleNa(row.id, true)}>
                      Not applicable this period
                    </button>
                  )
                )}
                {!editable && row.update?.notApplicableReason && (
                  <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">Not applicable: {row.update.notApplicableReason}</span>
                )}
                {row.previous && editable && !notApplicable && v.periodAchievement.trim() === "" && (
                  <button
                    type="button"
                    className="mt-1 block text-xs text-brand-600 hover:underline dark:text-brand-400"
                    title={`Last period (to ${row.previous.periodEnd}) you entered ${row.previous.periodAchievement}`}
                    onClick={() => onChange(row.id, { periodAchievement: row.previous!.periodAchievement })}
                  >
                    Same as last period ({row.previous.periodAchievement})
                  </button>
                )}
                {showBreakdown && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-brand-600 hover:underline dark:text-brand-400"
                    aria-expanded={open}
                    aria-controls={`breakdown-${row.id}`}
                    onClick={() => onToggleBreakdown(row.id)}
                  >
                    {open ? "Hide" : "Breakdown"} ({v.disaggregation.length})
                    {row.disaggregationRequired && v.disaggregation.length === 0 && <span className="ml-1 text-warning-700 dark:text-warning-400">required</span>}
                  </button>
                )}
              </td>
              <td className="min-w-[120px] px-3 py-2">
                <Input
                  value={v.cumulativeAchievement}
                  onChange={(e) => onChange(row.id, { cumulativeAchievement: e.target.value })}
                  disabled={!editable || notApplicable}
                  placeholder={row.aggregation === "SUM" && row.previous?.cumulativeAchievement ? `Last: ${row.previous.cumulativeAchievement}` : "Running total"}
                  className="min-h-[38px] px-2 py-1 text-xs"
                  aria-label={`Cumulative achievement for ${row.code}`}
                />
              </td>
              <td className="min-w-[160px] px-3 py-2">
                <Input
                  value={v.comments}
                  onChange={(e) => onChange(row.id, { comments: e.target.value })}
                  disabled={!editable}
                  placeholder="Notes"
                  className="min-h-[38px] px-2 py-1 text-xs"
                  aria-label={`Comments for ${row.code}`}
                />
              </td>
              <td className="min-w-[160px] px-3 py-2">
                <Input
                  value={v.dataSource}
                  onChange={(e) => onChange(row.id, { dataSource: e.target.value })}
                  disabled={!editable}
                  placeholder="Source of the figure"
                  className="min-h-[38px] px-2 py-1 text-xs"
                  aria-label={`Data source for ${row.code}`}
                />
              </td>
              <td className="px-3 py-2">
                {row.update ? (
                  <div className="flex flex-col gap-1">
                    <Badge tone={indicatorVerificationTone(row.update.verificationStatus)}>
                      {INDICATOR_VERIFICATION_LABEL[row.update.verificationStatus] ?? row.update.verificationStatus}
                    </Badge>
                    {row.update.reviewNote && row.update.verificationStatus !== "VERIFIED" ? (
                      <span className="max-w-[220px] text-xs text-amber-700 dark:text-amber-300">
                        Reviewer: {row.update.reviewNote}
                      </span>
                    ) : null}
                  </div>
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
            {showBreakdown && open && (
              <tr id={`breakdown-${row.id}`} className="bg-slate-50/60 dark:bg-white/5">
                <td colSpan={COLUMN_COUNT} className="px-3 py-3">
                  <DisaggregationEditor
                    entries={v.disaggregation}
                    onChange={(entries) => onChange(row.id, { disaggregation: entries })}
                    disabled={!editable}
                    total={v.periodAchievement}
                    summable={row.breakdownMustSum ?? false}
                    targetGroups={row.targetGroups}
                    label={`Breakdown for ${row.code}`}
                  />
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
