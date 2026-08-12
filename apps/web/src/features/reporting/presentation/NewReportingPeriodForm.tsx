"use client";

import { useState } from "react";
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

export function NewReportingPeriodForm({
  projectId,
  templates,
}: {
  projectId: string;
  templates: Array<{ id: string; templateName: string }>;
}) {
  const router = useRouter();
  const actionState = useActionState();
  const [reportType, setReportType] = useState("MONTHLY");
  const [donorTemplateId, setDonorTemplateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [internalReviewDeadline, setInternalReviewDeadline] = useState("");
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});

  const fields = actionState.fields ?? localErrors;
  const errorCount = Object.keys(fields).reduce((sum, key) => sum + (fields[key]?.length ?? 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
            <option key={t.id} value={t.id}>{t.templateName}</option>
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
        <Field label="Donor deadline" htmlFor="deadline" error={fields.deadline?.[0]}>
          <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} invalid={Boolean(fields.deadline)} required />
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
  );
}
