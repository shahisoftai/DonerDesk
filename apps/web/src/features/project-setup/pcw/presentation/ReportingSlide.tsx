"use client";

import { useState, useTransition } from "react";
import type { ReportTypeRule } from "@donordesk/domain";
import { editDraftAction } from "@/lib/actions/project-setup-draft";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { usePcwCopy } from "./usePcwCopy";
import { parseDays } from "../domain/entry-view";
import { CADENCES, CADENCE_LABEL, addableTypes, formatDay, removeRule, reportTypeLabel, ruleGaps, shownPeriods, upsertRule } from "../domain/schedule-view";

type Work = () => Promise<{ ok: true; value: SetupDraftView } | { ok: false; error: { message: string } }>;

/**
 * Slide 8: how often the project reports, which kinds of report it makes and who writes, reviews and approves each, and the
 * calendar that follows from the project's dates. The calendar is the one launch will create, so it is shown, never edited here.
 */
export function ReportingSlide({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const pcw = usePcwCopy();
  const PCW_COPY = pcw.c;
  const c = PCW_COPY.reporting;
  const schedule = view.extras.schedule;
  const rules = schedule.rules;
  const { rows, hidden } = shownPeriods(view);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (work: Work) => startTransition(async () => { const r = await work(); if (r.ok) { setError(null); onView(r.value); } else setError(r.error.message); });
  const set = (patch: Record<string, unknown>) => run(() => editDraftAction(id, { kind: "SET_SCHEDULE", patch }));
  const setRules = (next: ReportTypeRule[]) => set({ rules: next });

  return (
    <div className="space-y-8">
      <section aria-labelledby="pcw-cadence" className="grid gap-4 sm:grid-cols-2">
        <h2 id="pcw-cadence" className="text-lg font-semibold sm:col-span-2">{c.cadenceTitle}</h2>
        <Field label={c.cadence}>
          <Select value={schedule.cadence ?? ""} onChange={(e) => e.target.value && set({ cadence: e.target.value })}>
            <option value="">{c.choose}</option>
            {CADENCES.map((k) => <option key={k} value={k}>{CADENCE_LABEL[k]}</option>)}
          </Select>
        </Field>
        <label className="flex items-center gap-2 self-end text-sm"><Checkbox checked={schedule.reminders} onChange={(e) => set({ reminders: e.target.checked })} /> {c.reminders}</label>
      </section>

      <section aria-labelledby="pcw-rules" className="space-y-3">
        <h2 id="pcw-rules" className="text-lg font-semibold">{c.rulesTitle}</h2>
        {rules.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{c.noRules}</p> : null}
        {rules.map((r) => {
          const gaps = ruleGaps(r);
          return (
            <article key={r.reportType} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{reportTypeLabel(r.reportType)}</h3>
                <button type="button" className="btn-secondary" disabled={pending} onClick={() => setRules(removeRule(rules, r.reportType))} aria-label={`${c.remove} ${reportTypeLabel(r.reportType)}`}>{c.remove}</button>
              </header>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={c.template}>
                  <Select value={r.template ?? ""} onChange={(e) => setRules(upsertRule(rules, r.reportType, { template: e.target.value || null }))}>
                    <option value="">{c.choose}</option>
                    <option value="BUILT_IN">{c.builtIn}</option>
                  </Select>
                </Field>
                <Field label={c.due}>
                  <Input key={`d-${r.dueDaysAfterEnd}`} inputMode="numeric" defaultValue={r.dueDaysAfterEnd ?? ""} onBlur={(e) => { const n = parseDays(e.target.value); if (n === null) return setError("Days until a report is due is a whole number from 0 to 365."); if (n !== r.dueDaysAfterEnd) setRules(upsertRule(rules, r.reportType, { dueDaysAfterEnd: n })); }} />
                </Field>
              </div>
              {gaps.length > 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">Still needs {gaps.join(", ")}.</p> : null}
            </article>
          );
        })}
        <div className="flex flex-wrap items-end gap-3">
          {addableTypes(rules).length > 0 ? (
            <Field label={c.add}>
              <Select value="" onChange={(e) => e.target.value && setRules(upsertRule(rules, e.target.value))}>
                <option value="">{c.choose}</option>
                {addableTypes(rules).map((t) => <option key={t} value={t}>{reportTypeLabel(t)}</option>)}
              </Select>
            </Field>
          ) : null}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{c.templateNote} {c.rolesNote}</p>
      </section>

      <section aria-labelledby="pcw-calendar" className="space-y-2">
        <h2 id="pcw-calendar" className="text-lg font-semibold">{c.calendarTitle}</h2>
        {view.timeline.note ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{view.timeline.note}</p> : (
          <ol className="divide-y divide-slate-200 rounded-xl border border-slate-200 text-sm dark:divide-white/10 dark:border-white/10">
            {rows.map((p) => (
              <li key={`${p.startDate}-${p.reportType}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>{formatDay(p.startDate)} – {formatDay(p.endDate)}{p.closing ? ` · ${c.closing}` : ""}</span>
                <span className="text-slate-600 dark:text-slate-300">{p.dueDate ? c.dueLine(formatDay(p.dueDate)) : ""}</span>
              </li>
            ))}
            {hidden > 0 ? <li className="px-4 py-2 text-slate-600 dark:text-slate-300">{c.more(hidden)}</li> : null}
          </ol>
        )}
        <p className="text-sm text-slate-600 dark:text-slate-300">{c.rollUpNote}</p>
      </section>
      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
