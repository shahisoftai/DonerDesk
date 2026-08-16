"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProjectAction } from "@/lib/actions/projects";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { FormSummary } from "@/components/ui/FormSummary";
import { SECTOR_LABEL, SECTOR_OPTIONS, REPORT_FREQUENCY_LABEL } from "@/lib/labels";
import type { ProjectDetail } from "@/lib/server/schemas";

const STATUS_OPTIONS = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

function toDateInput(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function ProjectSettingsForm({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const actionState = useActionState();
  const [title, setTitle] = useState(project.title);
  const [projectCode, setProjectCode] = useState(project.projectCode);
  const [donorName, setDonorName] = useState(project.donorName);
  const [implementingOrganization, setImplementingOrganization] = useState(project.implementingOrganization ?? "");
  const [partnerOrganization, setPartnerOrganization] = useState(project.partnerOrganization ?? "");
  const [country, setCountry] = useState(project.country);
  const [region, setRegion] = useState(project.region ?? "");
  const [district, setDistrict] = useState(project.district ?? "");
  const [sector, setSector] = useState(project.sector);
  const [reportingFrequency, setReportingFrequency] = useState(project.reportingFrequency);
  const [startDate, setStartDate] = useState(toDateInput(project.startDate));
  const [endDate, setEndDate] = useState(toDateInput(project.endDate));
  const [budgetAmount, setBudgetAmount] = useState(project.budget?.amount?.toString() ?? "");
  const [budgetCurrency, setBudgetCurrency] = useState(project.budget?.currency ?? "USD");
  const [description, setDescription] = useState(project.description ?? "");
  const [primaryContactName, setPrimaryContactName] = useState(project.primaryContactName ?? "");
  const [status, setStatus] = useState(project.status);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const payload: Record<string, unknown> = {
      title,
      projectCode,
      donorName,
      implementingOrganization,
      country,
      sector,
      reportingFrequency,
      status,
    };
    if (partnerOrganization.trim()) payload.partnerOrganization = partnerOrganization.trim();
    if (region.trim()) payload.region = region.trim();
    if (district.trim()) payload.district = district.trim();
    if (startDate) payload.startDate = new Date(startDate).toISOString();
    if (endDate) payload.endDate = new Date(endDate).toISOString();
    if (budgetAmount !== "") {
      const amount = Number(budgetAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        return;
      }
      payload.budgetAmount = amount;
    }
    if (budgetCurrency) payload.budgetCurrency = budgetCurrency;
    if (description.trim()) payload.description = description.trim();
    if (primaryContactName.trim()) payload.primaryContactName = primaryContactName.trim();

    const result = await actionState.run(() => updateProjectAction(project.id, payload));
    if (result !== undefined) {
      setSaved(true);
      router.refresh();
    }
  }

  const fields = actionState.fields ?? {};
  const errorCount = Object.keys(fields).reduce((sum, k) => sum + (fields[k]?.length ?? 0), 0);

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <div className="card space-y-4">
        <h3 className="font-semibold">Project configuration</h3>
        <FormSummary errors={fields} count={errorCount} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project title" htmlFor="settings-title" error={fields.title?.[0]}>
            <Input id="settings-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label="Project code" htmlFor="settings-code" error={fields.projectCode?.[0]}>
            <Input id="settings-code" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} required />
          </Field>
          <Field label="Donor name" htmlFor="settings-donor" error={fields.donorName?.[0]}>
            <Input id="settings-donor" value={donorName} onChange={(e) => setDonorName(e.target.value)} required />
          </Field>
          <Field label="Implementing organization" htmlFor="settings-implementing" error={fields.implementingOrganization?.[0]}>
            <Input id="settings-implementing" value={implementingOrganization} onChange={(e) => setImplementingOrganization(e.target.value)} required />
          </Field>
          <Field label="Partner organization" htmlFor="settings-partner">
            <Input id="settings-partner" value={partnerOrganization} onChange={(e) => setPartnerOrganization(e.target.value)} />
          </Field>
          <Field label="Country" htmlFor="settings-country" error={fields.country?.[0]}>
            <Input id="settings-country" value={country} onChange={(e) => setCountry(e.target.value)} required />
          </Field>
          <Field label="Region" htmlFor="settings-region">
            <Input id="settings-region" value={region} onChange={(e) => setRegion(e.target.value)} />
          </Field>
          <Field label="District" htmlFor="settings-district">
            <Input id="settings-district" value={district} onChange={(e) => setDistrict(e.target.value)} />
          </Field>
          <Field label="Sector" htmlFor="settings-sector" error={fields.sector?.[0]}>
            <Select id="settings-sector" value={sector} onChange={(e) => setSector(e.target.value)}>
              {SECTOR_OPTIONS.map((s) => <option key={s} value={s}>{SECTOR_LABEL[s] ?? s}</option>)}
            </Select>
          </Field>
          <Field label="Reporting frequency" htmlFor="settings-frequency" error={fields.reportingFrequency?.[0]}>
            <Select id="settings-frequency" value={reportingFrequency} onChange={(e) => setReportingFrequency(e.target.value)}>
              {Object.keys(REPORT_FREQUENCY_LABEL).map((f) => (
                <option key={f} value={f}>{REPORT_FREQUENCY_LABEL[f] ?? f}</option>
              ))}
            </Select>
          </Field>
          <Field label="Start date" htmlFor="settings-start" error={fields.startDate?.[0]}>
            <Input id="settings-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </Field>
          <Field label="End date" htmlFor="settings-end" error={fields.endDate?.[0]}>
            <Input id="settings-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </Field>
          <Field label="Budget amount" htmlFor="settings-budget" error={fields.budgetAmount?.[0]}>
            <Input id="settings-budget" type="number" min="0" step="0.01" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} />
          </Field>
          <Field label="Budget currency" htmlFor="settings-currency" error={fields.budgetCurrency?.[0]}>
            <Input id="settings-currency" value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value.toUpperCase())} maxLength={3} />
          </Field>
          <Field label="Primary contact" htmlFor="settings-contact">
            <Input id="settings-contact" value={primaryContactName} onChange={(e) => setPrimaryContactName(e.target.value)} />
          </Field>
          <Field label="Status" htmlFor="settings-status" error={fields.status?.[0]}>
            <Select id="settings-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Description" htmlFor="settings-description">
          <Textarea id="settings-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} />
        </Field>
        {actionState.error && (
          <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{actionState.error}</p>
        )}
        {saved && <p className="text-sm font-medium text-success-700 dark:text-success-400">Project settings saved.</p>}
        <div className="flex justify-end">
          <Button type="submit" pending={actionState.busy}>Save changes</Button>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold">Danger zone</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Ending a project moves it to the completed state and prevents new reporting periods. Archived projects are
          hidden from active lists.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const result = await actionState.run(() => updateProjectAction(project.id, { status: "COMPLETED" }));
              if (result !== undefined) router.refresh();
            }}
            pending={actionState.busy}
          >
            Mark completed
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              const result = await actionState.run(() => updateProjectAction(project.id, { status: "ARCHIVED" }));
              if (result !== undefined) router.refresh();
            }}
            pending={actionState.busy}
          >
            Archive project
          </Button>
        </div>
      </div>
    </form>
  );
}
