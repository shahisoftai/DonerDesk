"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction } from "@/lib/actions/projects";
import { useActionState } from "@/lib/client/action-state";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import {
  emptyWizardData,
  mergeInputErrors,
  type ProjectWizardData,
  type WizardFieldErrors,
} from "@/features/projects/validation/project-wizard";
import {
  SECTOR_OPTIONS,
  SECTOR_LABEL,
  REPORT_FREQUENCY_OPTIONS,
  REPORT_FREQUENCY_LABEL,
} from "@/lib/labels";

type StepKey = "identity" | "geography" | "reporting";

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: "identity", label: "Identity & donor" },
  { key: "geography", label: "Geography, sector & dates" },
  { key: "reporting", label: "Reporting" },
];

export default function GuidedProjectWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<ProjectWizardData>(emptyWizardData);
  const [errors, setErrors] = useState<WizardFieldErrors>({});
  const { busy, error, run } = useActionState();

  const step = STEPS[stepIndex]!.key;

  function update(path: "step" | "geography" | "reporting", patch: Record<string, string>) {
    setData((d) => ({ ...d, [path]: { ...d[path], ...patch } }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  }

  function goNext() {
    const stepErrors = mergeInputErrors(step, data);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function submit() {
    const result = await run(() =>
      createProjectAction({
        title: data.step.title,
        projectCode: data.step.projectCode,
        donorName: data.step.donorName,
        implementingOrganization: data.step.implementingOrganization,
        partnerOrganization: data.step.partnerOrganization || undefined,
        country: data.geography.country,
        region: data.geography.region || undefined,
        district: data.geography.district || undefined,
        sector: data.geography.sector,
        startDate: new Date(data.geography.startDate).toISOString(),
        endDate: new Date(data.geography.endDate).toISOString(),
        reportingFrequency: data.reporting.reportingFrequency,
        budgetAmount: data.reporting.budgetAmount ? Number(data.reporting.budgetAmount) : undefined,
        budgetCurrency: data.reporting.budgetCurrency || undefined,
        primaryContactName: data.reporting.primaryContactName || undefined,
        description: data.reporting.description || undefined,
      }),
    );
    if (result) router.push(`/projects/${result.id}/setup`);
  }

  const fieldError = (key: string) => (errors[key] ? errors[key][0] : undefined);

  return (
    <div className="animate-fade-in mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Create a project</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Set up a donor-funded project workspace. Work is kept in your browser until you submit at the end.
      </p>

      <ol className="mt-6 flex items-center gap-2 text-xs" aria-label="Project setup progress">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full font-bold ${
                i < stepIndex
                  ? "bg-success-500 text-white"
                  : i === stepIndex
                    ? "bg-brand-500 text-white"
                    : "border border-slate-300 text-slate-400 dark:border-white/15 dark:text-slate-500"
              }`}
              aria-current={i === stepIndex ? "step" : undefined}
            >
              {i < stepIndex ? "✓" : i + 1}
            </span>
            <span className={i === stepIndex ? "font-semibold" : ""}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="text-slate-300 dark:text-white/15">—</span>}
          </li>
        ))}
      </ol>

      <form
        className="card mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (stepIndex < STEPS.length - 1) goNext();
          else void submit();
        }}
      >
        {step === "identity" && (
          <>
            <Field label="Project title" htmlFor="title" error={fieldError("title")}>
              <Input id="title" value={data.step.title} invalid={Boolean(errors.title)} onChange={(e) => update("step", { title: e.target.value })} required />
            </Field>
            <Field label="Project code" htmlFor="projectCode" error={fieldError("projectCode")}>
              <Input id="projectCode" value={data.step.projectCode} invalid={Boolean(errors.projectCode)} onChange={(e) => update("step", { projectCode: e.target.value })} required />
            </Field>
            <Field label="Donor name" htmlFor="donorName" error={fieldError("donorName")}>
              <Input id="donorName" value={data.step.donorName} invalid={Boolean(errors.donorName)} onChange={(e) => update("step", { donorName: e.target.value })} required />
            </Field>
            <Field label="Implementing organization" htmlFor="implementingOrganization" error={fieldError("implementingOrganization")}>
              <Input id="implementingOrganization" value={data.step.implementingOrganization} invalid={Boolean(errors.implementingOrganization)} onChange={(e) => update("step", { implementingOrganization: e.target.value })} required />
            </Field>
            <Field label="Partner organization (optional)" htmlFor="partnerOrganization">
              <Input id="partnerOrganization" value={data.step.partnerOrganization ?? ""} onChange={(e) => update("step", { partnerOrganization: e.target.value })} />
            </Field>
          </>
        )}

        {step === "geography" && (
          <>
            <Field label="Country" htmlFor="country" error={fieldError("country")}>
              <Input id="country" value={data.geography.country} invalid={Boolean(errors.country)} onChange={(e) => update("geography", { country: e.target.value })} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Region (optional)" htmlFor="region">
                <Input id="region" value={data.geography.region ?? ""} onChange={(e) => update("geography", { region: e.target.value })} />
              </Field>
              <Field label="District (optional)" htmlFor="district">
                <Input id="district" value={data.geography.district ?? ""} onChange={(e) => update("geography", { district: e.target.value })} />
              </Field>
            </div>
            <Field label="Sector" htmlFor="sector">
              <Select id="sector" value={data.geography.sector} onChange={(e) => update("geography", { sector: e.target.value })}>
                {SECTOR_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {SECTOR_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date" htmlFor="startDate" error={fieldError("startDate")}>
                <Input id="startDate" type="date" value={data.geography.startDate} invalid={Boolean(errors.startDate)} onChange={(e) => update("geography", { startDate: e.target.value })} required />
              </Field>
              <Field label="End date" htmlFor="endDate" error={fieldError("endDate")}>
                <Input id="endDate" type="date" value={data.geography.endDate} invalid={Boolean(errors.endDate)} onChange={(e) => update("geography", { endDate: e.target.value })} required />
              </Field>
            </div>
            {errors.endDate && (
              <InlineAlert tone="danger" title={errors.endDate[0] ?? "Check the dates."} />
            )}
          </>
        )}

        {step === "reporting" && (
          <>
            <Field label="Reporting frequency" htmlFor="reportingFrequency">
              <Select id="reportingFrequency" value={data.reporting.reportingFrequency} onChange={(e) => update("reporting", { reportingFrequency: e.target.value })}>
                {REPORT_FREQUENCY_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {REPORT_FREQUENCY_LABEL[f]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Budget (optional)" htmlFor="budgetAmount" error={fieldError("budgetAmount")}>
                <Input id="budgetAmount" type="number" value={data.reporting.budgetAmount ?? ""} invalid={Boolean(errors.budgetAmount)} onChange={(e) => update("reporting", { budgetAmount: e.target.value })} />
              </Field>
              <Field label="Currency (optional, e.g. USD)" htmlFor="budgetCurrency">
                <Input id="budgetCurrency" value={data.reporting.budgetCurrency ?? ""} onChange={(e) => update("reporting", { budgetCurrency: e.target.value.toUpperCase() })} />
              </Field>
            </div>
            <Field label="Primary contact (optional)" htmlFor="primaryContactName">
              <Input id="primaryContactName" value={data.reporting.primaryContactName ?? ""} onChange={(e) => update("reporting", { primaryContactName: e.target.value })} />
            </Field>
            <Field label="Description (optional)" htmlFor="description">
              <Textarea id="description" value={data.reporting.description ?? ""} onChange={(e) => update("reporting", { description: e.target.value })} />
            </Field>
            <ReviewSummary data={data} />
          </>
        )}

        {error && (
          <InlineAlert tone="danger" title={error} />
        )}

        <div className="flex justify-between">
          <Button type="button" variant="secondary" onClick={goBack} disabled={stepIndex === 0}>
            Back
          </Button>
          <Button type="submit" pending={busy}>
            {stepIndex < STEPS.length - 1 ? "Next" : busy ? "Creating..." : "Create project"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ReviewSummary({ data }: { data: ProjectWizardData }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
      <div className="font-semibold">Review</div>
      <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <Row label="Project" value={data.step.title} />
        <Row label="Code" value={data.step.projectCode} />
        <Row label="Donor" value={data.step.donorName} />
        <Row label="Country" value={data.geography.country} />
        <Row label="Sector" value={SECTOR_LABEL[data.geography.sector]} />
        <Row label="Frequency" value={REPORT_FREQUENCY_LABEL[data.reporting.reportingFrequency]} />
        <Row label="Start" value={data.geography.startDate} />
        <Row label="End" value={data.geography.endDate} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium">{value || "—"}</dd>
    </div>
  );
}
