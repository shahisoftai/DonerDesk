"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  validateConfig,
  knownTemplates,
  DEFAULT_SECTION_LABEL,
  INFOGRAPHIC_TEMPLATES,
  type InfographicConfig,
  type InfographicSectionConfig,
  type InfographicSectionKind,
} from "@donordesk/domain/contexts/infographics/index.js";
import type { DataSheet } from "@donordesk/domain/contexts/reporting/data-sheet.js";
import { buildDataChart, DATA_CHART_TEMPLATES, DATA_CHART_TEMPLATE_ORDER } from "@donordesk/domain/contexts/reporting/data-charts.js";
import { EChartFigure } from "@/features/reporting/presentation/ChartFigure";
import { siteMapData } from "@/features/workplan/domain/site-map";
import { SiteMapFigure } from "@/features/workplan/presentation/SiteMapFigure";
import { comparisonMatrix, kpiCards, locationResultRows, mapPoints, type InfographicData } from "../domain/studio-view";
import { SECTION_LABEL, SEX_LABEL, AGE_LABEL, STUDIO_HINT } from "../domain/infographics-copy";

interface DesignRecord {
  id: string;
  title: string;
  templateId: string;
  templateVersion: number;
  configJson: string;
  exportCount?: number;
}

interface ExportRow {
  id: string;
  format: string;
  createdAt: string;
  generatedById: string;
}

type SectionDraft = InfographicSectionConfig;

/** The Studio (mock 7): sections left, live preview centre, section settings right. Template-driven — no free canvas. */
export function InfographicStudio({
  projectId,
  design,
  data,
  sheet,
  canEdit,
  canExport,
}: {
  projectId: string;
  design: DesignRecord;
  data: InfographicData;
  sheet: DataSheet;
  canEdit: boolean;
  canExport: boolean;
}) {
  const [title, setTitle] = useState(design.title);
  const [sections, setSections] = useState<SectionDraft[]>(() => {
    try {
      return (JSON.parse(design.configJson) as InfographicConfig).sections;
    } catch {
      return [];
    }
  });
  const [selected, setSelected] = useState<number>(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [addOpen, setAddOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<string | undefined>();
  const [exports, setExports] = useState<ExportRow[]>([]);

  const config: InfographicConfig = {
    templateId: design.templateId,
    templateVersion: design.templateVersion,
    ...(title.trim() && title.trim() !== INFOGRAPHIC_TEMPLATES[design.templateId as keyof typeof INFOGRAPHIC_TEMPLATES]?.label ? { title: title.trim() } : {}),
    sections,
  };
  const validation = useMemo(() => validateConfig(config, knownTemplates()), [config]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: SectionDraft[]): void => {
    setSections(next);
    setDirty(true);
  };

  const move = (index: number, delta: number): void => {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    setSelected(target);
    update(next);
  };

  const patch = (index: number, changes: Partial<SectionDraft>): void => {
    update(sections.map((section, i) => (i === index ? { ...section, ...changes } : section)));
  };

  const addSection = (kind: InfographicSectionKind): void => {
    setAddOpen(false);
    const extra: Partial<SectionDraft> = kind === "CHART" ? { chart: { template: "INDICATOR_OVER_TIME", indicatorIds: [], measure: "PERIOD", type: "LINE" } } : {};
    update([...sections, { kind, ...extra }]);
    setSelected(sections.length);
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(undefined);
    setMessage(undefined);
    const response = await fetch(`/api/infographics/${design.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, config }),
    });
    const body = (await response.json()) as { error?: { title?: string } };
    setSaving(false);
    if (response.ok) {
      setDirty(false);
      setMessage("Saved.");
    } else setError(body.error?.title ?? "The design could not be saved.");
  };

  const publish = async (format: "PNG" | "PDF"): Promise<void> => {
    setExporting(format);
    setError(undefined);
    const pins = mapPoints(data).map((point) => {
      const resolved = siteMapData([{ id: point.id, title: point.title, location: point.location, signal: point.signal }], { country: data.project.country });
      const place = resolved.points[0];
      return place ? { name: place.name, lat: place.lat, lng: place.lng, worst: place.worst, count: point.count } : null;
    }).filter((point): point is NonNullable<typeof point> => point !== null);
    const response = await fetch(`/api/infographics/${design.id}/exports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format, mapPoints: pins }),
    });
    const body = (await response.json()) as { id?: string; error?: { title?: string } };
    setExporting(undefined);
    if (response.ok && body.id) {
      setMessage(`Published. The download starts below — later changes never alter this file.`);
      const list = await fetch(`/api/infographics/${design.id}/exports`, { cache: "no-store" });
      const listed = (await list.json()) as { items?: ExportRow[] };
      setExports(listed.items ?? []);
      setExportOpen(false);
    } else setError(body.error?.title ?? "The export could not be created.");
  };

  const selectedSection = sections[selected];
  const cards = kpiCards(data);
  const resultRows = locationResultRows(data, selectedSection?.indicatorIds, config.locationKeys);

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <Link className="text-sm text-slate-500 hover:text-slate-800" href={`/projects/${projectId}/infographics`}>
          ← All infographics
        </Link>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{INFOGRAPHIC_TEMPLATES[design.templateId as keyof typeof INFOGRAPHIC_TEMPLATES]?.label ?? design.templateId}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${dirty ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{dirty ? "Unsaved changes" : "Saved"}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canEdit && (
            <button type="button" className="btn-secondary" disabled={!dirty || saving || !validation.ok} onClick={() => void save()}>
              {saving ? "Saving…" : "Save"}
            </button>
          )}
          {canExport && (
            <>
              <button type="button" className="btn-secondary" onClick={() => setExportOpen(true)}>
                Export PDF
              </button>
              <button type="button" className="btn-primary" onClick={() => setExportOpen(true)}>
                Export PNG
              </button>
            </>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {INFOGRAPHIC_TEMPLATES[design.templateId as keyof typeof INFOGRAPHIC_TEMPLATES]?.description} Missing data shows as “Not yet reported” — never zero.
      </p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {message && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">{message}</p>}
      {!validation.ok && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This design has a problem: {validation.error.message}</p>}
      {exports.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {exports.map((row) => (
            <a key={row.id} className="text-brand-700 underline dark:text-brand-300" href={`/api/infographics/${design.id}/exports/${row.id}/file`}>
              Download {row.format} · {new Date(row.createdAt).toLocaleString("en-GB")}
            </a>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        {/* Sections */}
        <div className="card h-fit p-3">
          <h3 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sections</h3>
          {sections.map((section, index) => (
            <div key={`${section.kind}-${index}`} className={`mb-1.5 flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm ${selected === index ? "border-brand-600 ring-2 ring-brand-100" : "border-slate-200"} ${section.hidden ? "opacity-50" : ""}`}>
              <button type="button" className="flex-1 truncate text-left" onClick={() => setSelected(index)} disabled={!canEdit}>
                {section.title ?? SECTION_LABEL[section.kind]}
                {section.hidden ? " (hidden)" : ""}
              </button>
              {canEdit && (
                <>
                  <button type="button" aria-label="Move up" className="text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={index === 0} onClick={() => move(index, -1)}>
                    ↑
                  </button>
                  <button type="button" aria-label="Move down" className="text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={index === sections.length - 1} onClick={() => move(index, 1)}>
                    ↓
                  </button>
                  <button type="button" aria-label="Show or hide" className="text-slate-400 hover:text-slate-700" onClick={() => patch(index, { hidden: !section.hidden })}>
                    {section.hidden ? "🚫" : "👁"}
                  </button>
                  <button type="button" aria-label="Remove" className="text-slate-400 hover:text-red-600" onClick={() => { update(sections.filter((_, i) => i !== index)); setSelected(0); }}>
                    ✕
                  </button>
                </>
              )}
            </div>
          ))}
          {canEdit && (
            <div className="relative">
              <button type="button" className="w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-sm text-brand-700 dark:text-brand-300" onClick={() => setAddOpen((open) => !open)}>
                + Add section
              </button>
              {addOpen && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg dark:border-white/10 dark:bg-slate-900">
                  {(Object.keys(SECTION_LABEL) as InfographicSectionKind[]).map((kind) => (
                    <button key={kind} type="button" className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => addSection(kind)}>
                      {SECTION_LABEL[kind]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{data.project.donorName} · {data.project.country}</p>
            <h2 className="text-xl font-bold tracking-tight">{title || INFOGRAPHIC_TEMPLATES[design.templateId as keyof typeof INFOGRAPHIC_TEMPLATES]?.label}</h2>
            <p className="text-xs text-slate-500">{data.project.start} – {data.project.end} · {data.project.projectCode}</p>
          </div>
          {sections.map((section, index) =>
            section.hidden ? null : (
              <section key={`${section.kind}-${index}`} className={`rounded-lg border p-3 ${selected === index ? "border-brand-600" : "border-slate-200 dark:border-white/10"}`} onClick={() => setSelected(index)}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">{section.title ?? SECTION_LABEL[section.kind]}</h3>
                <SectionPreview section={section} data={data} sheet={sheet} rows={section.kind === "LOCATION_RESULTS" ? resultRows : []} />
              </section>
            ),
          )}
          <p className="border-t border-slate-200 pt-2 text-[11px] text-slate-400 dark:border-white/10">
            Data: {data.periods.map((p) => p.label).join(" – ")} · {data.provenance.unverifiedValues > 0 ? `${data.provenance.unverifiedValues} value${data.provenance.unverifiedValues === 1 ? "" : "s"} not yet verified · ` : ""}Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Settings */}
        <div className="card h-fit p-3">
          <h3 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Section settings</h3>
          {selectedSection ? (
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Title</span>
                <input type="text" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 dark:border-white/10 dark:bg-slate-800" value={selectedSection.title ?? ""} placeholder={SECTION_LABEL[selectedSection.kind]} disabled={!canEdit} onChange={(event) => patch(selected, { title: event.target.value })} />
              </label>
              {selectedSection.kind === "TEXT" && (
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">Text</span>
                  <textarea rows={5} maxLength={600} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 dark:border-white/10 dark:bg-slate-800" value={selectedSection.text ?? ""} disabled={!canEdit} onChange={(event) => patch(selected, { text: event.target.value })} />
                </label>
              )}
              {selectedSection.kind === "CHART" && selectedSection.chart && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-500">Chart</span>
                    <select className="w-full rounded-lg border border-slate-300 px-2 py-1.5 dark:border-white/10 dark:bg-slate-800" value={selectedSection.chart.template} disabled={!canEdit} onChange={(event) => patch(selected, { chart: { ...selectedSection.chart!, template: event.target.value as typeof selectedSection.chart.template, indicatorIds: [] } })}>
                      {DATA_CHART_TEMPLATE_ORDER.map((id) => (
                        <option key={id} value={id}>
                          {DATA_CHART_TEMPLATES[id].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-500">Indicators</span>
                    <select
                      multiple
                      size={5}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 dark:border-white/10 dark:bg-slate-800"
                      value={selectedSection.chart.indicatorIds}
                      disabled={!canEdit}
                      onChange={(event) => {
                        const ids = Array.from(event.target.selectedOptions).map((option) => option.value);
                        patch(selected, { chart: { ...selectedSection.chart!, indicatorIds: ids } });
                      }}
                    >
                      {data.indicators.map((indicator) => (
                        <option key={indicator.id} value={indicator.id}>
                          {indicator.code} {indicator.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {selectedSection.kind === "LOCATION_RESULTS" && (
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">Indicators (none = every one with location data)</span>
                  <select
                    multiple
                    size={5}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 dark:border-white/10 dark:bg-slate-800"
                    value={selectedSection.indicatorIds ?? []}
                    disabled={!canEdit}
                    onChange={(event) => patch(selected, { indicatorIds: Array.from(event.target.selectedOptions).map((option) => option.value) })}
                  >
                    {data.indicators.map((indicator) => (
                      <option key={indicator.id} value={indicator.id}>
                        {indicator.code} {indicator.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Size</span>
                <select className="w-full rounded-lg border border-slate-300 px-2 py-1.5 dark:border-white/10 dark:bg-slate-800" value={selectedSection.size ?? "FULL"} disabled={!canEdit} onChange={(event) => patch(selected, { size: event.target.value as SectionDraft["size"] })}>
                  <option value="FULL">Full width</option>
                  <option value="HALF">Half</option>
                  <option value="THIRD">Third</option>
                </select>
              </label>
            </div>
          ) : (
            <p className="px-1 text-sm text-slate-500">Select a section to edit it.</p>
          )}
        </div>
      </div>

      {exportOpen && canExport && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <h3 className="text-lg font-semibold">Publish this design</h3>
            <p className="mt-1 text-sm text-slate-500">
              The export freezes the current figures with a provenance footer. Regenerating later never changes a published file — the data it was built from is recorded with it.
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-primary flex-1" disabled={exporting !== undefined || !validation.ok} onClick={() => void publish("PNG")}>
                {exporting === "PNG" ? "Rendering…" : "PNG image"}
              </button>
              <button type="button" className="btn-secondary flex-1" disabled={exporting !== undefined || !validation.ok} onClick={() => void publish("PDF")}>
                {exporting === "PDF" ? "Rendering…" : "PDF document"}
              </button>
            </div>
            <button type="button" className="mt-3 w-full text-sm text-slate-500 underline" onClick={() => setExportOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One section of the live preview, drawn from the same functions the export composer uses server-side. */
function SectionPreview({ section, data, sheet, rows }: { section: SectionDraft; data: InfographicData; sheet: DataSheet; rows: ReturnType<typeof locationResultRows> }) {
  if (section.kind === "KPIS") {
    return (
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {kpiCards(data).map((card) => (
          <div key={card.label} className="rounded-lg bg-slate-50 p-3 dark:bg-white/5">
            <p className={`text-lg font-bold ${card.muted ? "text-slate-400 italic" : ""}`}>{card.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{card.label}</p>
            {card.detail && <p className="mt-0.5 text-[11px] text-amber-700">{card.detail}</p>}
          </div>
        ))}
      </div>
    );
  }
  if (section.kind === "CHART" && section.chart) {
    const built = buildDataChart(sheet, { ...section.chart, fromPeriodId: undefined, toPeriodId: undefined, showTarget: section.chart.showTarget ?? false });
    if (!built.ok) return <p className="text-sm italic text-slate-400">{STUDIO_HINT.chartEmpty}</p>;
    return <EChartFigure option={built.option} caption={built.notes.join(" · ") || undefined} />;
  }
  if (section.kind === "LOCATION_RESULTS") {
    if (rows.length === 0) return <p className="text-sm italic text-slate-400">{STUDIO_HINT.resultsEmpty}</p>;
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
            <th className="py-1.5 pr-2">Location</th>
            <th className="py-1.5 pr-2 text-right">Target</th>
            <th className="py-1.5 pr-2 text-right">Achieved</th>
            <th className="py-1.5 text-right">% of target</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((row, index) => (
            <tr key={`${row.indicatorCode}-${row.location}-${index}`} className="border-b border-slate-100 dark:border-white/5">
              <td className="py-1.5 pr-2 font-medium">
                {row.indicatorCode} {row.location}
                {row.verified ? "" : <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">{STUDIO_HINT.unverified}</span>}
              </td>
              <td className="py-1.5 pr-2 text-right">{row.target ?? <span className="italic text-slate-400">{STUDIO_HINT.notPlanned}</span>}</td>
              <td className="py-1.5 pr-2 text-right">{row.actual ?? <span className="italic text-slate-400">{STUDIO_HINT.notReported}</span>}</td>
              <td className="py-1.5 text-right">{row.percentOfTarget ? `${row.percentOfTarget}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (section.kind === "LOCATION_COMPARISON") {
    const matrix = comparisonMatrix(data, section.locationKeys);
    if (matrix.indicators.length === 0) return <p className="text-sm italic text-slate-400">{STUDIO_HINT.comparisonEmpty}</p>;
    const locationNames = new Map(matrix.locations.map((key) => [key, data.indicators.flatMap((indicator) => (indicator.location.kind === "PROJECT_WIDE" ? [] : indicator.location.rows)).find((row) => row.key === key)?.location ?? key]));
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
            <th className="py-1.5 pr-2">Location</th>
            {matrix.indicators.map((indicator) => (
              <th key={indicator.id} className="py-1.5 pr-2">{indicator.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...locationNames.entries()].map(([key, name]) => (
            <tr key={key} className="border-b border-slate-100 dark:border-white/5">
              <td className="py-1.5 pr-2 font-medium">{name}</td>
              {matrix.indicators.map((indicator) => {
                const cell = matrix.cells.find((candidate) => candidate.indicatorId === indicator.id && candidate.location === key);
                return (
                  <td key={indicator.id} className={`py-1.5 pr-2 ${cell ? (cell.verified ? "" : "text-amber-700") : "italic text-slate-400"}`}>
                    {cell ? cell.value : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (section.kind === "REACH") {
    const reach = data.reach;
    if (reach.overallUnique === 0) return <p className="text-sm italic text-slate-400">{STUDIO_HINT.reachEmpty}</p>;
    const max = Math.max(1, ...reach.registeredByLocation.map((row) => row.unique));
    const attendances = reach.attendancesByActivityLocation.reduce((total, row) => total + row.attendances, 0);
    return (
      <div>
        <p className="font-semibold">{reach.overallUnique.toLocaleString("en-US")} unique people <span className="text-sm font-normal text-slate-500">· {reach.registeredTotal.toLocaleString("en-US")} registered</span></p>
        <div className="mt-2 space-y-1.5">
          {reach.registeredByLocation.slice(0, 5).map((row) => (
            <div key={row.key} className="flex items-center gap-2 text-sm">
              <span className="w-32 shrink-0 truncate">{row.location}</span>
              <span className="h-2.5 flex-1 rounded-full bg-slate-100 dark:bg-white/10">
                <span className="block h-full rounded-full bg-violet-500" style={{ width: `${(row.unique / max) * 100}%` }} />
              </span>
              <span className="w-10 text-right">{row.unique}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">{attendances} attendances (a person may attend several){reach.beneficiariesWithoutLocation > 0 ? ` · ${reach.beneficiariesWithoutLocation} without a recorded location` : ""}</p>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          {Object.entries(reach.bySex).map(([sex, count]) => (
            <span key={sex}>{SEX_LABEL[sex] ?? sex}: {count}</span>
          ))}
          {Object.entries(reach.byAgeGroup).map(([age, count]) => (
            <span key={age}>{AGE_LABEL[age] ?? age}: {count}</span>
          ))}
        </div>
      </div>
    );
  }
  if (section.kind === "ACTIVITIES_BY_LOCATION") {
    if (data.activities.rows.length === 0 && data.activities.unlocated === 0) return <p className="text-sm italic text-slate-400">{STUDIO_HINT.activitiesEmpty}</p>;
    const max = Math.max(1, ...data.activities.rows.map((row) => row.planned));
    return (
      <div className="space-y-1.5">
        {data.activities.rows.slice(0, 6).map((row) => (
          <div key={row.key} className="flex items-center gap-2 text-sm">
            <span className="w-32 shrink-0 truncate">{row.location}</span>
            <span className="h-4 flex-1 rounded-full bg-slate-100 dark:bg-white/10">
              <span className="block h-full rounded-full bg-brand-600" style={{ width: `${(row.done / max) * 100}%` }} />
            </span>
            <span className="w-36 text-right text-xs text-slate-500">{row.done} / {row.planned} done{row.late > 0 ? ` · ${row.late} late` : ""}</span>
          </div>
        ))}
        {data.activities.unlocated > 0 && <p className="text-xs italic text-slate-400">{data.activities.unlocated} without a recorded location</p>}
      </div>
    );
  }
  if (section.kind === "MAP") {
    const points = mapPoints(data);
    if (points.length === 0) return <p className="text-sm italic text-slate-400">{STUDIO_HINT.mapEmpty}</p>;
    const mapped = siteMapData(
      points.map((point) => ({ id: point.id, title: point.title, location: point.location, signal: point.signal })),
      { country: data.project.country },
    );
    if (mapped.points.length === 0) return <p className="text-sm italic text-slate-400">{STUDIO_HINT.mapUnplaced}</p>;
    return <SiteMapFigure points={mapped.points} country={data.project.country} caption={`${mapped.points.length} site${mapped.points.length === 1 ? "" : "s"}${mapped.unplaced.length > 0 ? ` · ${mapped.unplaced.length} not placed` : ""}`} />;
  }
  if (section.kind === "TEXT") {
    if (!section.text) return <p className="text-sm italic text-slate-400">Nothing written yet.</p>;
    return <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{section.text}</p>;
  }
  return <p className="text-sm italic text-slate-400">Nothing to show.</p>;
}
