"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { quickEnterValueAction } from "@/lib/actions/indicators";
import type { QuickEntryResponse } from "@/lib/server/schemas";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { guardNetwork, isOfflineFailure } from "@/lib/shared/connectivity";
import { useHydrated } from "@/lib/client/use-hydrated";
import { useOutbox } from "@/features/offline/presentation/OutboxProvider";
import { indicatorValuesEntry } from "@/features/offline/domain/indicator-values-outbox";
import { dateLanding, enterableIndicators, filterIndicators, nextIndicatorId, offlineRow, valueProblem, type QuickIndicator, type QuickPeriod } from "@/features/reporting/domain/quick-entry-view";

/**
 * Enter one indicator value without first finding the reporting period: pick the indicator, type the value and the day it is
 * for. The period is worked out from the day (and shown before saving), the running total is suggested by the server, and the
 * project's review setting decides whether the value is handed in. Offline, the value is kept on this device and sent later.
 */
export function QuickEntryForm({
  projectId,
  indicators,
  periods,
  initialIndicatorId,
  today,
  simpleReview,
  canVerify,
}: {
  projectId: string;
  indicators: QuickIndicator[];
  periods: QuickPeriod[];
  initialIndicatorId?: string | undefined;
  today: string;
  simpleReview: boolean;
  canVerify: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outbox = useOutbox();
  const valueRef = useRef<HTMLInputElement>(null);
  const typable = useMemo(() => enterableIndicators(indicators), [indicators]);
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => filterIndicators(typable, filter), [typable, filter]);
  const [indicatorId, setIndicatorId] = useState(() => (typable.some((i) => i.id === initialIndicatorId) ? initialIndicatorId! : typable[0]?.id ?? ""));
  const [date, setDate] = useState(today);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [source, setSource] = useState("");
  const [result, setResult] = useState<(QuickEntryResponse & { code: string; label: string; queued?: boolean }) | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const indicator = typable.find((i) => i.id === indicatorId);
  const landing = useMemo(() => dateLanding(date, periods), [date, periods]);

  // A filter that hides the chosen indicator moves the choice to the first one still shown, so the select never shows one thing and saves another.
  useEffect(() => {
    if (shown.length > 0 && !shown.some((i) => i.id === indicatorId)) setIndicatorId(shown[0]!.id);
  }, [shown, indicatorId]);

  async function save() {
    if (!indicator) return;
    const missing = valueProblem(value);
    if (missing) { setProblem(missing); valueRef.current?.focus(); return; }
    if (landing.kind !== "FOUND") { setProblem(landing.message); return; }
    if (busy) return;
    setProblem(null);
    setResult(null);
    setError(null);
    const input = { indicatorId: indicator.id, date, periodAchievement: value.trim(), ...(note.trim() ? { comments: note.trim() } : {}), ...(source.trim() ? { dataSource: source.trim() } : {}) };
    setBusy(true);
    // No connection (or one that drops mid-call) is an ordinary answer here, not an exception.
    const answer = await guardNetwork(() => quickEnterValueAction(input));
    setBusy(false);
    if (answer.ok) {
      setResult({ ...answer.value, code: indicator.code, label: landing.label });
      finishEntry(indicator.id);
      router.refresh();
      return;
    }
    // Keep the value on this device; the outbox sends it when the connection returns.
    if (!isOfflineFailure(answer.error)) {
      setError(answer.error.message);
      return;
    }
    await outbox.enqueue(indicatorValuesEntry({
      id: crypto.randomUUID(),
      title: `${indicator.code}: ${value.trim()}`,
      payload: { periodId: landing.periodId, rows: [offlineRow({ indicatorId: indicator.id, value, note, source })] },
      now: Date.now(),
    }));
    setResult({ id: "", reportingPeriodId: landing.periodId, chosenBy: "DATE", cumulative: "", cumulativeSource: "NONE", outcome: "SAVED_DRAFT", notices: ["No connection. The value is kept on this device and will be sent when you are back online."], code: indicator.code, label: landing.label, queued: true });
    finishEntry(indicator.id);
  }

  /** Carry on with the next indicator, same day: clear only what belongs to this value. */
  function finishEntry(currentId: string) {
    setValue("");
    setNote("");
    setSource("");
    setFilter("");
    setIndicatorId(nextIndicatorId(typable, currentId));
    window.setTimeout(() => valueRef.current?.focus(), 0);
  }

  if (typable.length === 0) {
    return <InlineAlert tone="info" title="There is nothing to type a value into yet">Add indicators in the logframe first. Indicators that are calculated from others cannot be typed into.</InlineAlert>;
  }

  const sheetHref = landing.kind === "FOUND" ? `/projects/${projectId}/reports/${landing.periodId}/inputs?tab=indicators` : `/projects/${projectId}/reports`;

  return (
    <form className="card max-w-2xl space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }} aria-label="Enter a value">
      <Field label="Indicator" description={typable.length > 8 ? "Type to narrow the list." : undefined}>
        <div className="space-y-2">
          {typable.length > 8 && <Input aria-label="Find an indicator" placeholder="Find by code or name" value={filter} onChange={(e) => setFilter(e.target.value)} />}
          <Select aria-label="Indicator" value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)} disabled={!hydrated}>
            {shown.map((i) => <option key={i.id} value={i.id}>{i.code} — {i.name}</option>)}
          </Select>
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="The day this value is for" error={landing.kind === "INVALID" ? landing.message : undefined}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={indicator?.unit ? `Value (${indicator.unit})` : "Value"} error={problem ?? undefined}>
          <Input ref={valueRef} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => { setValue(e.target.value); setProblem(null); }} placeholder="e.g. 120" />
        </Field>
      </div>

      <p className="text-sm" role="status" aria-live="polite">
        {landing.kind === "FOUND" && <span>This is recorded in <strong>{landing.label}</strong>.{landing.locked ? " That report is locked, so the save will be refused." : ""}</span>}
        {landing.kind === "NONE" && <span className="text-warning-700 dark:text-warning-400">{landing.message} <Link className="underline" href={`/projects/${projectId}/reports`}>Open reporting</Link></span>}
      </p>

      {indicator?.disaggregationRequired && (
        <InlineAlert tone="warning" title="This indicator also needs a breakdown">
          You can save the total now. Add the breakdown (for example by sex or age) in <Link className="underline" href={sheetHref}>the period&rsquo;s sheet</Link>.
        </InlineAlert>
      )}

      <details>
        <summary className="cursor-pointer text-sm text-slate-600 dark:text-slate-300">Add a note or where the figure came from</summary>
        <div className="mt-3 grid gap-4">
          <Field label="Where the figure came from (optional)"><Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Clinic register, May" /></Field>
          <Field label="Note (optional)"><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></Field>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" pending={busy} disabled={!hydrated || landing.kind !== "FOUND"}>
          {simpleReview ? "Save and hand in" : "Save"}
        </Button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {simpleReview
            ? canVerify ? "This project hands values in as you save them. With a file attached, your own values are verified too." : "This project hands values in as you save them."
            : "Saved as a draft. Hand it in from the period's sheet when you are ready."}
        </span>
      </div>

      {error && !result && <p role="alert" className="text-sm text-danger-700 dark:text-danger-400">{error}</p>}

      {result && (
        <div role="status" className="rounded-lg border border-success-200 bg-success-50 p-3 text-sm text-success-900 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-100">
          <p className="font-medium">{result.queued ? "Kept on this device" : "Saved"}: {result.code} in {result.label}.</p>
          {result.notices.map((n) => <p key={n} className="mt-1">{n}</p>)}
          <p className="mt-2"><Link className="underline" href={`/projects/${projectId}/reports/${result.reportingPeriodId}/inputs?tab=indicators`}>Open the period&rsquo;s sheet</Link></p>
        </div>
      )}
    </form>
  );
}
