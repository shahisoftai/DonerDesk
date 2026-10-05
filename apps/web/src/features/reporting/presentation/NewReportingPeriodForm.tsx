"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// A deep, package.json-whitelisted import, not the "@donordesk/domain" barrel:
// the barrel re-exports domain-event.js, which uses node:crypto and cannot be
// bundled for the browser (this form is a client component).
import { suggestPeriodDates, suggestDeadline, defaultDeadlineOffsetForType, DEFAULT_DEADLINE_OFFSET_DAYS } from "@donordesk/domain/contexts/reporting/period-cadence.js";
import { createReportingPeriodAction } from "@/lib/actions/reporting";
import { useActionState } from "@/lib/client/action-state";
import { validateReportDates } from "@/lib/shared/report-dates";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { missingScopeFields, normalizeEventName, type ReportScope } from "@donordesk/domain/contexts/reporting/report-scope.js";
import { FormSummary } from "@/components/ui/FormSummary";
import { ReportScopeFields, cleanScope } from "./ReportScopeFields";
import { PeriodTypeGuide, type PeriodTypeOptionView } from "./PeriodTypeGuide";
import { REPORT_TYPE_LABEL, REPORT_TYPE_OPTIONS } from "@/lib/labels";
import type { ProjectReadiness } from "@/lib/server/schemas";
import { blockerHref } from "@/lib/shared/readiness-links";

function MissingSetupItems({ projectId, readiness }: { projectId: string; readiness: ProjectReadiness }) {
  return (
    <div className="card mt-6 max-w-2xl border-danger-500/40 bg-danger-50/40 dark:border-danger-500/25 dark:bg-danger-500/[0.06]">
      <h2 className="font-semibold text-danger-800 dark:text-danger-300">Project setup is not complete</h2>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
        Reporting periods cannot be created until the following items are complete:
      </p>
      <ul className="mt-3 space-y-2">
        {readiness.blockers.map((b) => (
          <li key={b.code} className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{b.code}</span>
              <p className="text-slate-800 dark:text-slate-200">{b.label}</p>
            </div>
            {b.href && (
              <Link className="btn-secondary shrink-0 text-sm" href={blockerHref(projectId, b.href)}>Fix</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NewReportingPeriodForm({
  projectId,
  templates,
  activities = [],
  situationHistory = [],
  readiness,
  periodOptions,
  projectBounds = null,
  existingPeriodEnds = [],
  profileDeadlineOffsetDays,
}: {
  projectId: string;
  templates: Array<{ id: string; templateName: string; reportType?: string; status?: string; deadlineOffsetDays?: number; deadlineRule?: string }>;
  readiness: ProjectReadiness | null;
  /** What may be created now per type, computed by the server from the same rules that refuse a bad period. */
  periodOptions?: PeriodTypeOptionView[];
  /** The project's recorded activities, offered when creating an activity report. */
  activities?: Array<{ id: string; title: string; date: string; location?: string }>;
  /** Earlier situation reports (event + as-of end date), so a new one continues the series. */
  situationHistory?: Array<{ eventName?: string; endDate: string }>;
  /** The project's own start/end dates — bound every suggested period and are FINAL's own end date. */
  projectBounds?: { startDate: string; endDate: string } | null;
  /** End dates of this project's existing periods, so the next suggestion starts right after the latest one. */
  existingPeriodEnds?: string[];
  /** Fallback deadline offset (days after the period ends) from the project's reporting profile, used when the chosen template states none. */
  profileDeadlineOffsetDays?: number;
}) {
  const router = useRouter();
  const actionState = useActionState();
  const [reportType, setReportType] = useState("MONTHLY");
  const [donorTemplateId, setDonorTemplateId] = useState("");
  const [scope, setScope] = useState<ReportScope>({});
  const patchScope = (patch: Partial<ReportScope>) => setScope((s) => ({ ...s, ...patch }));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deadlineAuto, setDeadlineAuto] = useState(false);
  // Both dates are auto-suggested from the report type and the project's own
  // dates until the user edits either one by hand.
  const [datesAuto, setDatesAuto] = useState(true);
  // A short activity/situation report only takes a template of its own kind; a
  // full-report donor template would force a full-report structure on it.
  const usableTemplates = templates.filter((t) => (reportType === "ACTIVITY" || reportType === "SITUATION" ? t.reportType === reportType : true));
  const selectedTemplate = usableTemplates.find((t) => t.id === donorTemplateId);
  const suggestedDates = useMemo(() => {
    // Activity report: exactly the span of the activities picked.
    if (reportType === "ACTIVITY") {
      const picked = activities.filter((a) => scope.activityIds?.includes(a.id)).map((a) => a.date.slice(0, 10)).sort();
      return picked.length > 0 ? { startDate: picked[0]!, endDate: picked[picked.length - 1]! } : null;
    }
    // Situation report: from just after the previous report on this event up to the as-of date.
    if (reportType === "SITUATION") {
      if (!scope.situationDate) return null;
      const event = normalizeEventName(scope.eventName);
      const previous = situationHistory
        .filter((h) => event && normalizeEventName(h.eventName) === event)
        .map((h) => h.endDate.slice(0, 10))
        .sort()
        .pop();
      let start = scope.situationDate;
      if (previous && previous < scope.situationDate) {
        const d = new Date(`${previous}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        start = d.toISOString().slice(0, 10);
      }
      return { startDate: start, endDate: scope.situationDate };
    }
    // Regular reports: the server already worked out where the next period sits (it ignores one-off reports).
    const serverOption = periodOptions?.find((o) => o.type === reportType);
    if (serverOption) return serverOption.suggestedDates ?? null;
    return projectBounds ? suggestPeriodDates(reportType, projectBounds.startDate, projectBounds.endDate, existingPeriodEnds) : null;
  }, [reportType, periodOptions, projectBounds, existingPeriodEnds, activities, scope.activityIds, scope.situationDate, scope.eventName, situationHistory]);

  // Suggests Start/End from the report type + the project's dates, chained
  // after the latest existing period. Activity/Situation take their dates from
  // the picked activities / the as-of date; Custom stays manual.
  useEffect(() => {
    if (!datesAuto) return;
    setStartDate(suggestedDates?.startDate ?? "");
    setEndDate(suggestedDates?.endDate ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-suggest when the report type changes, not on every keystroke
  }, [suggestedDates]);

  // The deadline auto-fills as the period's end date plus an offset: the
  // template's own (if extracted from the donor's document), else the
  // project's reporting-profile offset, else a 30-day default — so it is
  // never left pointing at whatever the user last typed for "end date".
  const typeDeadlineOffset = defaultDeadlineOffsetForType(reportType);
  const deadlineOffsetDays = selectedTemplate?.deadlineOffsetDays ?? typeDeadlineOffset ?? profileDeadlineOffsetDays ?? DEFAULT_DEADLINE_OFFSET_DAYS;
  const deadlineSource = selectedTemplate?.deadlineOffsetDays !== undefined
    ? (selectedTemplate.deadlineRule ? `From the template: ${selectedTemplate.deadlineRule}` : `From the template: ${deadlineOffsetDays} days after the period ends`)
    : typeDeadlineOffset !== undefined
      ? `Default for ${reportType.toLowerCase()} reports: ${deadlineOffsetDays} days after the period ends`
    : profileDeadlineOffsetDays !== undefined
      ? `From your reporting profile: ${deadlineOffsetDays} days after the period ends`
      : `Default: ${deadlineOffsetDays} days after the period ends`;
  useEffect(() => {
    if (!endDate || (deadline && !deadlineAuto)) return;
    setDeadline(suggestDeadline(endDate, deadlineOffsetDays));
    setDeadlineAuto(true);
  }, [deadlineOffsetDays, endDate]); // eslint-disable-line react-hooks/exhaustive-deps
  const [internalReviewDeadline, setInternalReviewDeadline] = useState("");
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});

  const fields = actionState.fields ?? localErrors;
  const errorCount = Object.keys(fields).reduce((sum, key) => sum + (fields[key]?.length ?? 0), 0);

  const notReady = readiness !== null && !readiness.ready;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (notReady) {
      setLocalErrors({ form: [readiness!.blockers[0]?.label ?? "Project setup is not complete."] });
      return;
    }
    const scopeErrors: Record<string, string[]> = {};
    const missing = missingScopeFields(reportType, scope);
    if (missing.includes("activityIds")) scopeErrors.activityIds = ["Select at least one activity for an activity report."];
    if (missing.includes("eventName")) scopeErrors.eventName = ["Name the event or situation."];
    if (missing.includes("situationDate")) scopeErrors.situationDate = ["Enter the date the situation refers to."];
    if (missing.includes("title")) scopeErrors.title = ["Give the report a title."];
    const dateErrors = validateReportDates({
      startDate,
      endDate,
      deadline,
      internalReviewDeadline: internalReviewDeadline || undefined,
    });
    if (Object.keys(dateErrors).length > 0 || Object.keys(scopeErrors).length > 0) {
      setLocalErrors({ ...dateErrors, ...scopeErrors });
      return;
    }
    setLocalErrors({});

    const result = await actionState.run(() =>
      createReportingPeriodAction({
        projectId,
        reportType,
        donorTemplateId: donorTemplateId || undefined,
        scope: reportType === "ACTIVITY" || reportType === "SITUATION" || reportType === "CUSTOM" ? cleanScope(scope) : undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        deadline: new Date(deadline).toISOString(),
        internalReviewDeadline: internalReviewDeadline ? new Date(internalReviewDeadline).toISOString() : undefined,
      }),
    );
    if (result) {
      router.push(`/projects/${projectId}/reports/${result.id}`);
    }
  }

  return (
    <div>
      {notReady && readiness && <MissingSetupItems projectId={projectId} readiness={readiness} />}
      {periodOptions && <div className="mt-6"><PeriodTypeGuide options={periodOptions} selected={reportType} projectId={projectId} /></div>}
      <form onSubmit={submit} className="card mt-6 max-w-2xl space-y-4" noValidate>
      <FormSummary errors={fields} count={errorCount} />

      <Field label="Report type" htmlFor="reportType" error={fields.reportType?.[0]}>
        <Select id="reportType" value={reportType} onChange={(e) => { setReportType(e.target.value); setScope({}); setLocalErrors({}); setDonorTemplateId(""); setDatesAuto(true); }}>
          {REPORT_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{REPORT_TYPE_LABEL[t] ?? t.replace(/_/g, " ")}{periodOptions?.find((o) => o.type === t)?.available === false ? " (not available)" : ""}</option>
          ))}
        </Select>
        {periodOptions?.find((o) => o.type === reportType)?.available === false && (
          <p role="status" className="mt-1 text-xs text-warning-800 dark:text-warning-300">
            {periodOptions.find((o) => o.type === reportType)?.why} {periodOptions.find((o) => o.type === reportType)?.nextAction}
          </p>
        )}
      </Field>


      <ReportScopeFields reportType={reportType} scope={scope} onChange={patchScope} fields={fields} activities={activities} />

      <Field
        label="Donor template"
        htmlFor="donorTemplateId"
        error={fields.donorTemplateId?.[0]}
        hint={usableTemplates.length === 0 ? `No ${reportType === "ACTIVITY" || reportType === "SITUATION" ? reportType.toLowerCase() + " " : ""}templates. That is fine: a ready-made ${reportType.replace(/_/g, "-").toLowerCase()} report structure is used.` : "Optional. Without a template the report uses a ready-made structure for this report type."}
      >
        <Select id="donorTemplateId" value={donorTemplateId} onChange={(e) => setDonorTemplateId(e.target.value)}>
          <option value="">No template</option>
          {usableTemplates.map((t) => (
            <option key={t.id} value={t.id}>{t.templateName}{t.status && t.status !== "REVIEWED" ? " (not approved yet)" : ""}</option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Start date"
          htmlFor="startDate"
          error={fields.startDate?.[0]}
          hint={datesAuto && startDate ? "Suggested from the report type and the project's dates." : undefined}
        >
          <Input id="startDate" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDatesAuto(false); }} invalid={Boolean(fields.startDate)} required />
        </Field>
        <Field
          label="End date"
          htmlFor="endDate"
          error={fields.endDate?.[0]}
          hint={datesAuto && endDate ? "Suggested from the report type and the project's dates." : undefined}
        >
          <Input id="endDate" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDatesAuto(false); }} invalid={Boolean(fields.endDate)} required />
        </Field>
        <Field label="Donor deadline" htmlFor="deadline" error={fields.deadline?.[0]} hint={deadlineAuto ? deadlineSource : undefined}>
          <Input id="deadline" type="date" value={deadline} onChange={(e) => { setDeadline(e.target.value); setDeadlineAuto(false); }} invalid={Boolean(fields.deadline)} required />
        </Field>
      </div>
      {!datesAuto && suggestedDates && (startDate !== suggestedDates.startDate || endDate !== suggestedDates.endDate) && (
        <button
          type="button"
          className="text-sm text-brand-600 hover:underline dark:text-brand-400"
          onClick={() => {
            setStartDate(suggestedDates.startDate);
            setEndDate(suggestedDates.endDate);
            setDatesAuto(true);
          }}
        >
          Use the suggested dates ({suggestedDates.startDate} – {suggestedDates.endDate})
        </button>
      )}

      <Field
        label="Internal review deadline (optional)"
        htmlFor="internalReviewDeadline"
        error={fields.internalReviewDeadline?.[0]}
      >
        <Input
          id="internalReviewDeadline"
          type="date"
          value={internalReviewDeadline}
          onChange={(e) => setInternalReviewDeadline(e.target.value)}
          invalid={Boolean(fields.internalReviewDeadline)}
        />
      </Field>

      {actionState.error && (
        <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">
          {actionState.error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" pending={actionState.busy}>Create period</Button>
      </div>
      </form>
    </div>
  );
}
