"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DisaggregationEntryInput } from "@donordesk/contracts";
import { DisaggregationEditor } from "@/features/logframe/presentation/DisaggregationEditor";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useHydrated } from "@/lib/client/use-hydrated";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { dateLanding, enterableIndicators, filterIndicators, nextIndicatorId, valueProblem, type QuickIndicator, type QuickPeriod } from "@/features/reporting/domain/quick-entry-view";
import { adviceFor, savingIsBlocked } from "../domain/entry-advice";
import type { ValueSaved, ValueSink } from "../ports/record-sink";
import type { PeriodOpener } from "../ports/record-services";
import { AdviceList } from "./AdviceList";
import { ConfirmationScreen } from "./ConfirmationScreen";
import { DayChips } from "./DayChips";
import { PeriodOpenCard } from "./PeriodOpenCard";

export interface ValueFormProps {
  projectId: string;
  indicators: ReadonlyArray<QuickIndicator>;
  periods: ReadonlyArray<QuickPeriod>;
  /** Today as a plain day. The host decides it (the project's zone later); the form never reads the clock. */
  today: string;
  sink: ValueSink;
  /** What to do when the day lands in no period. */
  periodOpener: PeriodOpener;
  /** Simple review is on: Save also hands the value in. Only the button's words change here; the server decides the rest. */
  simpleReview: boolean;
  canOpenPeriod: boolean;
  initialIndicatorId?: string | undefined;
  /** A manager opened a period from here: the host reloads its periods. */
  onPeriodsChanged: () => void;
  onSaved?: ((saved: ValueSaved) => void) | undefined;
  onDone: () => void;
  /** A value already saved for this indicator in this period, so the form can say so before a second one is added. */
  existingFor?: ((indicatorId: string, periodId: string) => { value: string; by?: string | undefined } | null) | undefined;
}

const summableType = (type: string | undefined) => type === "NUMBER" || type === "CURRENCY";

/**
 * Record a number: which one, how many, which day. Five fields or fewer; the rest waits under "Add detail". The same form is the page
 * at /enter, the Record sheet on a phone and the drawer on a desktop; it knows only a sink to write to, never how the write travels.
 */
export function ValueForm(props: ValueFormProps) {
  const { projectId, indicators, periods, today, sink, simpleReview, canOpenPeriod } = props;
  const { t } = useI18n();
  const hydrated = useHydrated();
  const valueRef = useRef<HTMLInputElement>(null);
  const typable = useMemo(() => enterableIndicators(indicators), [indicators]);
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => filterIndicators(typable, filter), [typable, filter]);
  const [indicatorId, setIndicatorId] = useState(() => (typable.some((i) => i.id === props.initialIndicatorId) ? props.initialIndicatorId! : typable[0]?.id ?? ""));
  const [date, setDate] = useState(today);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [source, setSource] = useState("");
  const [split, setSplit] = useState<DisaggregationEntryInput[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ValueSaved | null>(null);
  // "Open it and save": once the period exists, the number the person already typed is saved without typing it again.
  const [saveWhenOpen, setSaveWhenOpen] = useState(false);

  const indicator = typable.find((i) => i.id === indicatorId);
  const landing = useMemo(() => dateLanding(date, periods), [date, periods]);
  const periodId = landing.kind === "FOUND" ? landing.periodId : undefined;
  const splitComplete = split.length > 0 && split.every((e) => e.category.trim() !== "" && e.value.trim() !== "");
  const advice = useMemo(
    () => adviceFor({
      today, date, landing,
      indicator: indicator ? { code: indicator.code, disaggregationRequired: indicator.disaggregationRequired } : undefined,
      breakdownComplete: splitComplete,
      existingValue: indicator && periodId ? props.existingFor?.(indicator.id, periodId) ?? null : null,
    }),
    [today, date, landing, indicator, splitComplete, periodId, props],
  );
  const blocked = savingIsBlocked(advice);

  // A filter that hides the chosen indicator moves the choice to the first one still shown, so the box never shows one thing and saves another.
  useEffect(() => {
    if (shown.length > 0 && !shown.some((i) => i.id === indicatorId)) setIndicatorId(shown[0]!.id);
  }, [shown, indicatorId]);

  async function save() {
    if (!indicator || busy) return;
    const missing = valueProblem(value);
    if (missing) { setProblem(t("record.value.typeNumber")); valueRef.current?.focus(); return; }
    if (landing.kind !== "FOUND" || blocked) return;
    setProblem(null);
    setError(null);
    setBusy(true);
    const result = await sink.saveValue({
      indicatorId: indicator.id, code: indicator.code, date, periodId: landing.periodId, periodLabel: landing.label, value,
      note, source, disaggregation: split.filter((e) => e.category.trim() !== "" && e.value.trim() !== ""),
    });
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    setSaved(result.value);
    props.onSaved?.(result.value);
  }

  useEffect(() => {
    if (saveWhenOpen && landing.kind === "FOUND" && !blocked && !busy) {
      setSaveWhenOpen(false);
      void save();
    }
    // `save` reads the latest state it closes over on each render; only the arrival of the period triggers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveWhenOpen, landing.kind, blocked]);

  function another() {
    setValue(""); setNote(""); setSource(""); setSplit([]); setFilter(""); setSaved(null); setError(null);
    if (indicator) setIndicatorId(nextIndicatorId(typable, indicator.id));
    window.setTimeout(() => valueRef.current?.focus(), 0);
  }

  if (typable.length === 0) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("record.value.nothingToType")}</p>;

  if (saved) {
    return (
      <ConfirmationScreen
        queued={saved.queued}
        detail={saved.queued ? t("record.value.keptHint") : t("record.value.savedIn", { code: saved.code, period: saved.periodLabel })}
        notices={saved.notices}
        anotherLabel={t("record.value.another")}
        onAnother={another}
        onDone={props.onDone}
      />
    );
  }

  const saveLabel = simpleReview ? t("record.value.saveHandIn") : t("record.value.save");
  return (
    <form className="space-y-5" aria-label={t("record.value.title")} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="space-y-2">
        <label className="label" htmlFor="record-indicator">{t("record.value.which")}</label>
        {typable.length > 8 && <Input aria-label={t("record.value.find")} placeholder={t("record.value.find")} value={filter} onChange={(e) => setFilter(e.target.value)} />}
        <Select id="record-indicator" className="min-h-[52px] text-base" value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)} disabled={!hydrated}>
          {shown.map((i) => <option key={i.id} value={i.id}>{i.code} — {i.name}</option>)}
        </Select>
      </div>

      <div className="space-y-2">
        <label className="label" htmlFor="record-value">{indicator?.unit ? t("record.value.howManyUnit", { unit: indicator.unit }) : t("record.value.howMany")}</label>
        <Input
          id="record-value" ref={valueRef} inputMode="decimal" autoComplete="off" enterKeyHint="done"
          className="min-h-[64px] text-3xl font-bold" aria-invalid={problem ? true : undefined} aria-describedby={problem ? "record-value-problem" : undefined}
          value={value} onChange={(e) => { setValue(e.target.value); setProblem(null); }}
        />
        {problem && <p id="record-value-problem" role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{problem}</p>}
      </div>

      <DayChips date={date} today={today} onChange={setDate} />

      {landing.kind === "FOUND" && !landing.locked && (
        <p role="status" className="flex items-center gap-2 text-sm font-semibold text-success-700 dark:text-success-300">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>
          {t("record.value.countsToward", { period: landing.label })}
        </p>
      )}

      {landing.kind === "NONE" && <PeriodOpenCard projectId={projectId} date={date} canOpen={canOpenPeriod} opener={props.periodOpener} onOpened={() => { if (value.trim() !== "") setSaveWhenOpen(true); props.onPeriodsChanged(); }} />}
      <AdviceList advice={advice} hide={landing.kind === "NONE" ? ["NO_PERIOD_FOR_DAY"] : []} />

      <details className="group rounded-2xl border border-slate-300 bg-white dark:border-white/15 dark:bg-slate-900/40" open={indicator?.disaggregationRequired && split.length > 0 ? true : undefined}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4">
          <span><span className="font-bold">{t("record.value.addDetail")}</span><span className="text-sm text-slate-600 dark:text-slate-300"> · {t("record.value.addDetailHint")}</span></span>
          <span aria-hidden="true" className="transition group-open:rotate-90">▸</span>
        </summary>
        <div className="space-y-4 border-t border-slate-200 p-4 dark:border-white/10">
          {indicator?.disaggregationRequired && (
            <div className="space-y-2">
              <p className="label">{t("record.value.breakdown")}</p>
              <DisaggregationEditor entries={split} onChange={setSplit} disabled={false} total={value} summable={summableType(indicator.type)} label={t("record.value.breakdown")} touch />
            </div>
          )}
          <div className="space-y-2">
            <label className="label" htmlFor="record-source">{t("record.value.source")}</label>
            <Input id="record-source" value={source} placeholder={t("record.value.sourcePlaceholder")} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="record-note">{t("record.value.note")}</label>
            <Textarea id="record-note" rows={2} value={note} placeholder={t("record.value.notePlaceholder")} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      </details>

      {error && <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{error}</p>}

      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
        <button type="submit" className="btn-primary min-h-[52px] w-full text-base" disabled={!hydrated || busy || landing.kind !== "FOUND" || blocked}>{saveLabel}</button>
        {blocked && <p className="text-center text-xs text-slate-600 dark:text-slate-300">{t("record.value.saveBlockedHint")}</p>}
      </div>
    </form>
  );
}
