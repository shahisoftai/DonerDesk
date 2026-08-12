"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrganizationAction } from "@/lib/actions/org";
import { useActionState } from "@/lib/client/action-state";
import { can, type Capability } from "@/lib/shared/capabilities";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormSummary } from "@/components/ui/FormSummary";
import { InlineHelp } from "@/components/feedback/InlineHelp";
import {
  ORGANIZATION_TYPE_OPTIONS,
  ORGANIZATION_TYPE_LABEL,
  SECTOR_OPTIONS,
  LANGUAGE_OPTIONS,
  DATA_RESIDENCY_OPTIONS,
  DATA_RESIDENCY_LABEL,
} from "@/lib/labels";
import type { OrganizationProfile } from "@/lib/server/schemas";

export function SettingsPanel({
  org,
  capabilities,
}: {
  org: OrganizationProfile;
  capabilities: readonly Capability[];
}) {
  const router = useRouter();
  const actionState = useActionState();
  const canEdit = can(capabilities, "org.manage");

  const [name, setName] = useState(org.name);
  const [organizationType, setOrganizationType] = useState(org.organizationType || "OTHER");
  const [country, setCountry] = useState(org.country);
  const [sectors, setSectors] = useState<string[]>(org.sectors ?? []);
  const [contactName, setContactName] = useState(org.contactName);
  const [contactEmail, setContactEmail] = useState(org.contactEmail);
  const [website, setWebsite] = useState(org.website ?? "");
  const [defaultLanguage, setDefaultLanguage] = useState(org.defaultLanguage || "en");
  const [mainOfficeLocation, setMainOfficeLocation] = useState(org.mainOfficeLocation ?? "");
  const [donorTypesServed, setDonorTypesServed] = useState(org.donorTypesServed ?? "");
  const [dataResidency, setDataResidency] = useState(org.dataResidency || "DEFAULT");
  const [aiEnabled, setAiEnabled] = useState(org.aiEnabled ?? true);

  function toggleSector(sector: string) {
    setSectors((prev) => (prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const result = await actionState.run(() =>
      updateOrganizationAction({
        name,
        organizationType,
        country,
        sectors: sectors.length > 0 ? sectors : ["OTHER"],
        contactName,
        contactEmail,
        website: website || undefined,
        defaultLanguage,
        mainOfficeLocation: mainOfficeLocation || undefined,
        donorTypesServed: donorTypesServed || undefined,
        dataResidency,
        aiEnabled,
      }),
    );
    if (result !== undefined) router.refresh();
  }

  return (
    <form onSubmit={save} className="card mt-6 max-w-2xl space-y-4" noValidate>
      <FormSummary errors={actionState.fields ?? {}} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organization name" htmlFor="org-name" error={actionState.fields?.name?.[0]}>
          <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required />
        </Field>
        <Field label="Organization type" htmlFor="org-type" error={actionState.fields?.organizationType?.[0]}>
          <Select id="org-type" value={organizationType} onChange={(e) => setOrganizationType(e.target.value)} disabled={!canEdit}>
            {ORGANIZATION_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{ORGANIZATION_TYPE_LABEL[t] ?? t.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </Field>
        <Field label="Country" htmlFor="org-country" error={actionState.fields?.country?.[0]}>
          <Input id="org-country" value={country} onChange={(e) => setCountry(e.target.value)} disabled={!canEdit} required />
        </Field>
        <Field label="Default language" htmlFor="org-lang" error={actionState.fields?.defaultLanguage?.[0]}>
          <Select id="org-lang" value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)} disabled={!canEdit}>
            {LANGUAGE_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Contact name" htmlFor="org-contact-name" error={actionState.fields?.contactName?.[0]}>
          <Input id="org-contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} disabled={!canEdit} required />
        </Field>
        <Field label="Contact email" htmlFor="org-contact-email" error={actionState.fields?.contactEmail?.[0]}>
          <Input id="org-contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} disabled={!canEdit} required />
        </Field>
        <Field label="Website" htmlFor="org-website" error={actionState.fields?.website?.[0]}>
          <Input id="org-website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} disabled={!canEdit} />
        </Field>
        <Field label="Main office location" htmlFor="org-office" error={actionState.fields?.mainOfficeLocation?.[0]}>
          <Input id="org-office" value={mainOfficeLocation} onChange={(e) => setMainOfficeLocation(e.target.value)} disabled={!canEdit} />
        </Field>
        <Field label="Donor types served" htmlFor="org-donors" error={actionState.fields?.donorTypesServed?.[0]}>
          <Input id="org-donors" value={donorTypesServed} onChange={(e) => setDonorTypesServed(e.target.value)} disabled={!canEdit} />
        </Field>
        <Field label="Data residency" htmlFor="org-residency" error={actionState.fields?.dataResidency?.[0]}>
          <Select id="org-residency" value={dataResidency} onChange={(e) => setDataResidency(e.target.value)} disabled={!canEdit}>
            {DATA_RESIDENCY_OPTIONS.map((r) => (
              <option key={r} value={r}>{DATA_RESIDENCY_LABEL[r] ?? r}</option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
        <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Sectors</legend>
        <div className="flex flex-wrap gap-2">
          {SECTOR_OPTIONS.map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600 focus:ring-brand-500"
                checked={sectors.includes(s)}
                disabled={!canEdit}
                onChange={() => toggleSector(s)}
              />
              {s.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              AI-assisted reporting <InlineHelp help="When AI is enabled, report drafts are generated with AI assistance. When disabled, generation creates a blank draft for manual writing. Disabling AI never blocks manual editing." />
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              When AI is enabled, report drafts are generated with AI assistance. When disabled, generation creates a
              blank draft for manual writing.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600 focus:ring-brand-500"
              checked={aiEnabled}
              disabled={!canEdit}
              onChange={(e) => setAiEnabled(e.target.checked)}
            />
            AI enabled
          </label>
        </div>
      </div>

      {actionState.error && (
        <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{actionState.error}</p>
      )}

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" pending={actionState.busy}>Save settings</Button>
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          You do not have permission to edit organization settings.
        </p>
      )}
    </form>
  );
}
