"use client";

import { useState } from "react";
import {
  detectTemplateMappingAction,
  getTemplateMappingAction,
  updateTemplateMappingAction,
  approveTemplateMappingAction,
  lockTemplateMappingAction,
} from "@/lib/actions/donor-template-mapping";
import { Button } from "@/components/ui/Button";

type Region = { id: string; kind: "HEADING" | "TABLE"; level?: number; text: string; order: number };
type RegionMapping = { regionId: string; templateSectionId: string; placeholderKey: string; mappedBy: "AUTO" | "MANUAL"; status: "DRAFT" | "REVIEWED" | "APPROVED" };
type Mapping = {
  id: string;
  templateId: string;
  version: number;
  regions: RegionMapping[];
  detectedRegions: Region[];
  approvedById: string | null;
  approvedAt: string | null;
  templatedFileUrl: string | null;
};

/**
 * Detect -> review -> approve -> lock flow for donor-native DOCX rendering.
 * The backend (parser, auto-mapper, use cases, routes, docxtpl worker) has
 * existed since 2026-09-18 but had no UI — this closed the only missing
 * piece blocking a real pilot of DONOR_TEMPLATE_RENDER_ENABLED.
 */
export function TemplateMappingWizard({
  templateId,
  sections,
  periods,
}: {
  templateId: string;
  sections: Array<{ id: string; title: string }>;
  periods: Array<{ id: string; label: string }>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [assignments, setAssignments] = useState<Record<string, { templateSectionId: string; placeholderKey: string }>>({});
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reset(err?: string) {
    setBusy(false);
    setError(err ?? null);
  }

  async function refreshMapping(version: number) {
    const r = await getTemplateMappingAction(templateId, version);
    if (r.ok && r.value) {
      setMapping(r.value as Mapping);
      const next: Record<string, { templateSectionId: string; placeholderKey: string }> = {};
      for (const rm of r.value.regions) {
        next[rm.regionId] = { templateSectionId: rm.templateSectionId, placeholderKey: rm.placeholderKey };
      }
      setAssignments(next);
    }
  }

  async function detect() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await detectTemplateMappingAction(templateId, file);
    if (!r.ok) return reset(r.error.message);
    setNotice(`Detected ${r.value.regions.length} region(s) — ${r.value.autoMappedCount} auto-mapped, ${r.value.unmappedCount} need a manual choice.${r.value.warnings.length ? ` Warnings: ${r.value.warnings.join("; ")}` : ""}`);
    await refreshMapping(r.value.version);
    setBusy(false);
  }

  function setAssignment(regionId: string, patch: Partial<{ templateSectionId: string; placeholderKey: string }>) {
    setAssignments((prev) => ({
      ...prev,
      [regionId]: {
        templateSectionId: prev[regionId]?.templateSectionId ?? "",
        placeholderKey: prev[regionId]?.placeholderKey ?? `region_${regionId.replace(/[^a-zA-Z0-9]/g, "_")}`,
        ...patch,
      },
    }));
  }

  async function saveMapping() {
    if (!mapping) return;
    const regionUpdates = Object.entries(assignments)
      .filter(([, v]) => v.templateSectionId)
      .map(([regionId, v]) => ({ regionId, templateSectionId: v.templateSectionId, placeholderKey: v.placeholderKey }));
    if (regionUpdates.length === 0) {
      setError("Assign at least one region to a section before saving.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await updateTemplateMappingAction(mapping.id, regionUpdates);
    if (!r.ok) return reset(r.error.message);
    setNotice(`Saved ${regionUpdates.length} region mapping(s).`);
    await refreshMapping(mapping.version);
    setBusy(false);
  }

  async function approve() {
    if (!mapping || !file) return;
    setBusy(true);
    setError(null);
    const r = await approveTemplateMappingAction(mapping.id, file);
    if (!r.ok) return reset(r.error.message);
    setNotice("Mapping approved.");
    await refreshMapping(mapping.version);
    setBusy(false);
  }

  async function lock() {
    if (!mapping || !selectedPeriod) return;
    setBusy(true);
    setError(null);
    const r = await lockTemplateMappingAction(selectedPeriod, mapping.id);
    if (!r.ok) return reset(r.error.message);
    setNotice("Mapping locked to the selected reporting period. Exports for that period will now attempt donor-native rendering.");
    setBusy(false);
  }

  const isApproved = Boolean(mapping?.approvedAt);

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">1. Detect regions</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Upload the donor's own DOCX template. It will be parsed for headings and tables and auto-mapped to your report sections.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <Button size="sm" onClick={detect} disabled={!file} pending={busy}>Detect regions</Button>
        </div>
      </section>

      {mapping && (
        <section className="card">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">2. Review mapping</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Confirm or correct where each detected region should go. Saving marks the assigned regions reviewed.
          </p>
          <div className="table-shell mt-3">
            <table className="w-full text-sm">
              <thead className="thead">
                <tr>
                  <th className="px-3 py-2 text-left">Detected region</th>
                  <th className="px-3 py-2 text-left">Kind</th>
                  <th className="px-3 py-2 text-left">Maps to section</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {mapping.detectedRegions.map((region) => {
                  const assignment = assignments[region.id];
                  const status = mapping.regions.find((r) => r.regionId === region.id)?.status;
                  return (
                    <tr key={region.id} className="trow">
                      <td className="px-3 py-2">
                        <span className="block max-w-xs truncate" title={region.text}>{region.text || "(untitled)"}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{region.kind}</td>
                      <td className="px-3 py-2">
                        <select
                          value={assignment?.templateSectionId ?? ""}
                          onChange={(e) => setAssignment(region.id, { templateSectionId: e.target.value })}
                          disabled={isApproved}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-900"
                        >
                          <option value="">Not mapped</option>
                          {sections.map((s) => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                        {status ?? (assignment?.templateSectionId ? "Not saved" : "Unmapped")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!isApproved && (
            <div className="mt-3">
              <Button size="sm" onClick={saveMapping} pending={busy}>Save mapping</Button>
            </div>
          )}
        </section>
      )}

      {mapping && (
        <section className="card">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">3. Approve</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isApproved
              ? "This mapping is approved."
              : "Every mapped region must be reviewed (saved above) before approval. Approving requires the original file again."}
          </p>
          {!isApproved && (
            <div className="mt-2">
              <Button size="sm" onClick={approve} disabled={!file} pending={busy}>Approve mapping</Button>
            </div>
          )}
        </section>
      )}

      {mapping && isApproved && (
        <section className="card">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">4. Lock to a reporting period</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Exports for the locked period will attempt donor-native rendering (falls back to the generic export on any failure).
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-white/10 dark:bg-slate-900"
            >
              <option value="">Select a reporting period</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <Button size="sm" onClick={lock} disabled={!selectedPeriod} pending={busy}>Lock mapping</Button>
          </div>
        </section>
      )}

      {notice && <p className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
      {error && <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{error}</p>}
    </div>
  );
}
