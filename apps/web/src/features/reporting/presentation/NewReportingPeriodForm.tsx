"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createReportingPeriodAction } from "@/lib/actions/reporting";
import { useActionState } from "@/lib/client/action-state";
import { validateReportDates } from "@/lib/shared/report-dates";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormSummary } from "@/components/ui/FormSummary";
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
  readiness,
}: {
  projectId: string;
  templates: Array<{ id: string; templateName: string; status?: string; deadlineOffsetDays?: number; deadlineRule?: string }>;
  readiness: ProjectReadiness | null;
}) {
  const router = useRouter();
  const actionState = useActionState();
  const [reportType, setReportType] = useState("MONTHLY");
  const [donorTemplateId, setDonorTemplateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deadlineAuto, setDeadlineAuto] = useState(false);
  const selectedTemplate = templates.find((t) => t.id === donorTemplateId);

  // The donor's deadline rule from the template pre-fills the deadline until the user edits it.
  useEffect(() => {
    const offset = selectedTemplate?.deadlineOffsetDays;
    if (offset === undefined || !endDate || (deadline && !deadlineAuto)) return;
    const d = new Date(`${endDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    setDeadline(d.toISOString().slice(0, 10));
    setDeadlineAuto(true);
  }, [selectedTemplate?.deadlineOffsetDays, endDate]); // eslint-disable-line react-hooks/exhaustive-deps
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
    const dateErrors = validateReportDates({
      startDate,
      endDate,
      deadline,
      internalReviewDeadline: internalReviewDeadline || undefined,
    });
    if (Object.keys(dateErrors).length > 0) {
      setLocalErrors(dateErrors);
      return;
    }
    setLocalErrors({});

    const result = await actionState.run(() =>
      createReportingPeriodAction({
        projectId,
        reportType,
        donorTemplateId: donorTemplateId || undefined,
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
      <form onSubmit={submit} className="card mt-6 max-w-2xl space-y-4" noValidate>
      <FormSummary errors={fields} count={errorCount} />

      <Field label="Report type" htmlFor="reportType" error={fields.reportType?.[0]}>
        <Select id="reportType" value={reportType} onChange={(e) => setReportType(e.target.value)}>
          {REPORT_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{REPORT_TYPE_LABEL[t] ?? t.replace(/_/g, " ")}</option>
          ))}
        </Select>
      </Field>

      <Field
        label="Donor template"
        htmlFor="donorTemplateId"
        error={fields.donorTemplateId?.[0]}
        hint={templates.length === 0 ? "No templates yet. You can still create a period and attach a template later." : "Optional — attach a template to generate the report structure."}
      >
        <Select id="donorTemplateId" value={donorTemplateId} onChange={(e) => setDonorTemplateId(e.target.value)}>
          <option value="">No template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.templateName}{t.status && t.status !== "REVIEWED" ? " (not approved yet)" : ""}</option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Start date" htmlFor="startDate" error={fields.startDate?.[0]}>
          <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} invalid={Boolean(fields.startDate)} required />
        </Field>
        <Field label="End date" htmlFor="endDate" error={fields.endDate?.[0]}>
          <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} invalid={Boolean(fields.endDate)} required />
        </Field>
        <Field
          label="Donor deadline"
          htmlFor="deadline"
          error={fields.deadline?.[0]}
          hint={deadlineAuto && selectedTemplate?.deadlineRule ? `From the template: ${selectedTemplate.deadlineRule}` : undefined}
        >
          <Input id="deadline" type="date" value={deadline} onChange={(e) => { setDeadline(e.target.value); setDeadlineAuto(false); }} invalid={Boolean(fields.deadline)} required />
        </Field>
      </div>

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
