"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseEvidenceFilters,
  serializeEvidenceFilters,
  withEvidenceFilter,
  type EvidenceSearchParams,
} from "@/lib/shared/evidence-filters";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ActiveFilterChips } from "@/components/data/ActiveFilterChips";
import {
  EVIDENCE_VERIFICATION_LABEL,
  CONFIDENTIALITY_LABEL,
  EVIDENCE_TYPE_LABEL,
  EVIDENCE_TYPE_OPTIONS,
  EVIDENCE_VERIFICATION_OPTIONS,
  CONFIDENTIALITY_OPTIONS,
} from "@/lib/labels";

function toParams(current: string): EvidenceSearchParams {
  const qs = current.startsWith("?") ? current.slice(1) : current;
  return parseEvidenceFilters(new URLSearchParams(qs));
}

export interface EvidenceFilterOptions {
  /** Reporting periods of one project (the project page). */
  periods?: Array<{ id: string; label: string }>;
  /** Projects to choose from (the library across projects). */
  projects?: Array<{ id: string; label: string }>;
  donors?: string[];
  countries?: string[];
  /** Offer a "where it was collected" box. */
  location?: boolean;
}

export function EvidenceFilterBar({ baseUrl, current, options = {} }: { baseUrl: string; current: string; options?: EvidenceFilterOptions }) {
  const router = useRouter();
  const params = toParams(current);
  const [query, setQuery] = useState(params.query ?? "");
  const [location, setLocation] = useState(params.location ?? "");
  // The filters just chosen, until the page has re-rendered with them. A filter applies as soon as it is chosen, so a click on
  // "Apply" a moment later must build on it instead of on the previous address (that used to drop the choice).
  const [pending, setPending] = useState<{ from: string; params: EvidenceSearchParams } | null>(null);
  const base = pending && pending.from === current ? pending.params : params;

  function navigate(next: EvidenceSearchParams) {
    setPending({ from: current, params: next });
    router.push(`${baseUrl}${serializeEvidenceFilters(next)}`);
  }

  function update(key: "verificationStatus" | "confidentialityLevel" | "evidenceType" | "projectId" | "reportingPeriodId" | "donor" | "country", value: string) {
    navigate(withEvidenceFilter(base, key, value || undefined));
  }

  function submitQuery(e: React.FormEvent) {
    e.preventDefault();
    navigate(withEvidenceFilter(withEvidenceFilter(base, "location", location.trim() || undefined), "query", query || undefined));
  }

  const chips: Array<{ label: string; removeHref: string }> = [];
  if (params.query) chips.push({ label: `Search: ${params.query}`, removeHref: `${baseUrl}${serializeEvidenceFilters(withEvidenceFilter(params, "query", undefined))}` });
  if (params.verificationStatus) chips.push({ label: EVIDENCE_VERIFICATION_LABEL[params.verificationStatus] ?? params.verificationStatus, removeHref: `${baseUrl}${serializeEvidenceFilters(withEvidenceFilter(params, "verificationStatus", undefined))}` });
  if (params.confidentialityLevel) chips.push({ label: CONFIDENTIALITY_LABEL[params.confidentialityLevel] ?? params.confidentialityLevel, removeHref: `${baseUrl}${serializeEvidenceFilters(withEvidenceFilter(params, "confidentialityLevel", undefined))}` });
  if (params.evidenceType) chips.push({ label: EVIDENCE_TYPE_LABEL[params.evidenceType] ?? params.evidenceType, removeHref: `${baseUrl}${serializeEvidenceFilters(withEvidenceFilter(params, "evidenceType", undefined))}` });

  const chip = (label: string, key: Parameters<typeof withEvidenceFilter>[1]) => chips.push({ label, removeHref: `${baseUrl}${serializeEvidenceFilters(withEvidenceFilter(params, key, undefined))}` });
  if (params.projectId) chip(`Project: ${options.projects?.find((p) => p.id === params.projectId)?.label ?? "chosen"}`, "projectId");
  if (params.reportingPeriodId) chip(`Period: ${options.periods?.find((p) => p.id === params.reportingPeriodId)?.label ?? "chosen"}`, "reportingPeriodId");
  if (params.donor) chip(`Donor: ${params.donor}`, "donor");
  if (params.country) chip(`Country: ${params.country}`, "country");
  if (params.location) chip(`Where: ${params.location}`, "location");

  return (
    <div className="space-y-3">
      <form onSubmit={submitQuery} className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <label className="label" htmlFor="evidence-query">Search</label>
          <Input
            id="evidence-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="File name or title"
          />
        </div>
        <div>
          <label className="label" htmlFor="evidence-status">Verification</label>
          <Select id="evidence-status" value={params.verificationStatus ?? ""} onChange={(e) => update("verificationStatus", e.target.value)}>
            <option value="">All</option>
            {EVIDENCE_VERIFICATION_OPTIONS.map((s) => (
              <option key={s} value={s}>{EVIDENCE_VERIFICATION_LABEL[s] ?? s.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="evidence-conf">Confidentiality</label>
          <Select id="evidence-conf" value={params.confidentialityLevel ?? ""} onChange={(e) => update("confidentialityLevel", e.target.value)}>
            <option value="">All</option>
            {CONFIDENTIALITY_OPTIONS.map((c) => (
              <option key={c} value={c}>{CONFIDENTIALITY_LABEL[c]}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="evidence-type">Type</label>
          <Select id="evidence-type" value={params.evidenceType ?? ""} onChange={(e) => update("evidenceType", e.target.value)}>
            <option value="">All</option>
            {EVIDENCE_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{EVIDENCE_TYPE_LABEL[t] ?? t.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </div>
        {options.projects && (
          <div>
            <label className="label" htmlFor="evidence-project">Project</label>
            <Select id="evidence-project" value={params.projectId ?? ""} onChange={(e) => update("projectId", e.target.value)}>
              <option value="">All</option>
              {options.projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </div>
        )}
        {options.periods && (
          <div>
            <label className="label" htmlFor="evidence-period">Reporting period</label>
            <Select id="evidence-period" value={params.reportingPeriodId ?? ""} onChange={(e) => update("reportingPeriodId", e.target.value)}>
              <option value="">All</option>
              {options.periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </div>
        )}
        {options.donors && options.donors.length > 0 && (
          <div>
            <label className="label" htmlFor="evidence-donor">Donor</label>
            <Select id="evidence-donor" value={params.donor ?? ""} onChange={(e) => update("donor", e.target.value)}>
              <option value="">All</option>
              {options.donors.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
        )}
        {options.countries && options.countries.length > 0 && (
          <div>
            <label className="label" htmlFor="evidence-country">Country</label>
            <Select id="evidence-country" value={params.country ?? ""} onChange={(e) => update("country", e.target.value)}>
              <option value="">All</option>
              {options.countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        )}
        {options.location && (
          <div>
            <label className="label" htmlFor="evidence-location">Collected in</label>
            <Input id="evidence-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Village or district" />
          </div>
        )}
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      <ActiveFilterChips filters={chips} />
    </div>
  );
}
