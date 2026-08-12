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

export function EvidenceFilterBar({ baseUrl, current }: { baseUrl: string; current: string }) {
  const router = useRouter();
  const params = toParams(current);
  const [query, setQuery] = useState(params.query ?? "");

  function navigate(next: EvidenceSearchParams) {
    router.push(`${baseUrl}${serializeEvidenceFilters(next)}`);
  }

  function update(key: "verificationStatus" | "confidentialityLevel" | "evidenceType", value: string) {
    navigate(withEvidenceFilter(params, key, value || undefined));
  }

  function submitQuery(e: React.FormEvent) {
    e.preventDefault();
    navigate(withEvidenceFilter(params, "query", query || undefined));
  }

  const chips: Array<{ label: string; removeHref: string }> = [];
  if (params.query) chips.push({ label: `Search: ${params.query}`, removeHref: `${baseUrl}${serializeEvidenceFilters(withEvidenceFilter(params, "query", undefined))}` });
  if (params.verificationStatus) chips.push({ label: EVIDENCE_VERIFICATION_LABEL[params.verificationStatus] ?? params.verificationStatus, removeHref: `${baseUrl}${serializeEvidenceFilters(withEvidenceFilter(params, "verificationStatus", undefined))}` });
  if (params.confidentialityLevel) chips.push({ label: CONFIDENTIALITY_LABEL[params.confidentialityLevel] ?? params.confidentialityLevel, removeHref: `${baseUrl}${serializeEvidenceFilters(withEvidenceFilter(params, "confidentialityLevel", undefined))}` });
  if (params.evidenceType) chips.push({ label: EVIDENCE_TYPE_LABEL[params.evidenceType] ?? params.evidenceType, removeHref: `${baseUrl}${serializeEvidenceFilters(withEvidenceFilter(params, "evidenceType", undefined))}` });

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
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      <ActiveFilterChips filters={chips} />
    </div>
  );
}
