"use client";

import { useState } from "react";
import type { AffectedFigure, ReportScope } from "@donordesk/domain/contexts/reporting/report-scope.js";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export interface ScopeActivityOption {
  id: string;
  title: string;
  date: string;
  location?: string;
}

/**
 * What an activity / situation / custom report covers. Shared by the "new
 * reporting period" form and the "edit scope" panel so both ask the same
 * questions; cadence reports have no scope and render nothing.
 */
export function ReportScopeFields({
  reportType,
  scope,
  onChange,
  fields,
  activities,
}: {
  reportType: string;
  scope: ReportScope;
  onChange: (patch: Partial<ReportScope>) => void;
  /** Field errors by scope key. */
  fields: Record<string, string[] | undefined>;
  activities: ScopeActivityOption[];
}) {
  const patchScope = onChange;
  const [activityFilter, setActivityFilter] = useState("");
  return (
    <>
      {reportType === "ACTIVITY" && (
        <Field
          label="Activities covered"
          htmlFor="scopeActivities"
          error={fields.activityIds?.[0] ?? fields.scope?.[0]}
          hint={activities.length === 0 ? "No activities recorded yet. Add activity updates first, then create an activity report." : `${scope.activityIds?.length ?? 0} selected — the report covers only these activities.`}
        >
          <div id="scopeActivities" className="space-y-2">
            {activities.length > 6 && (
              <Input type="search" placeholder="Filter activities…" value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} aria-label="Filter activities" />
            )}
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-300 p-2 dark:border-white/10">
              {activities
                .filter((a) => a.title.toLowerCase().includes(activityFilter.trim().toLowerCase()))
                .map((a) => {
                  const checked = scope.activityIds?.includes(a.id) ?? false;
                  return (
                    <li key={a.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => {
                            const cur = scope.activityIds ?? [];
                            patchScope({ activityIds: checked ? cur.filter((id) => id !== a.id) : [...cur, a.id] });
                          }}
                        />
                        <span>
                          <span className="font-medium">{a.title}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {a.date.slice(0, 10)}{a.location ? ` · ${a.location}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
            </ul>
          </div>
        </Field>
      )}

      {reportType === "SITUATION" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Event / situation" htmlFor="scopeEventName" error={fields.eventName?.[0]}>
            <Input id="scopeEventName" value={scope.eventName ?? ""} onChange={(e) => patchScope({ eventName: e.target.value })} placeholder="e.g. Flooding in Sindh" invalid={Boolean(fields.eventName)} />
          </Field>
          <Field label="Situation date (as of)" htmlFor="scopeSituationDate" error={fields.situationDate?.[0]}>
            <Input id="scopeSituationDate" type="date" value={scope.situationDate ?? ""} onChange={(e) => patchScope({ situationDate: e.target.value })} invalid={Boolean(fields.situationDate)} />
          </Field>
          <Field label="Location / affected area (optional)" htmlFor="scopeLocation">
            <Input id="scopeLocation" value={scope.location ?? ""} onChange={(e) => patchScope({ location: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Situation summary (optional)" htmlFor="scopeSummary" hint="A few lines of context the report should build on.">
              <Textarea id="scopeSummary" rows={3} value={scope.summary ?? ""} onChange={(e) => patchScope({ summary: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Affected population (optional)"
              htmlFor="scopeAffected"
              hint="Figures you have from a named source. They appear in the report exactly as entered; none are estimated."
            >
              <div id="scopeAffected" className="space-y-2">
                {(scope.affectedPopulation ?? []).map((row, i) => {
                  const rows = scope.affectedPopulation ?? [];
                  const update = (patch: Partial<AffectedFigure>) => patchScope({ affectedPopulation: rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                  return (
                    <div key={i} className="grid gap-2 rounded-xl border border-slate-300 p-2 sm:grid-cols-[2fr_1fr_2fr_1fr_auto] dark:border-white/10">
                      <Input aria-label={`Group ${i + 1}`} placeholder="Who (e.g. Displaced households)" value={row.group} onChange={(e) => update({ group: e.target.value })} />
                      <Input aria-label={`Figure ${i + 1}`} placeholder="Figure" value={row.figure} onChange={(e) => update({ figure: e.target.value })} />
                      <Input aria-label={`Source ${i + 1}`} placeholder="Source (optional)" value={row.source ?? ""} onChange={(e) => update({ source: e.target.value })} />
                      <Input aria-label={`As of ${i + 1}`} type="date" value={row.asOf ?? ""} onChange={(e) => update({ asOf: e.target.value })} />
                      <button type="button" className="text-xs text-danger-700 hover:underline dark:text-danger-400" onClick={() => patchScope({ affectedPopulation: rows.filter((_, j) => j !== i) })}>Remove</button>
                    </div>
                  );
                })}
                <button type="button" className="text-sm text-brand-600 hover:underline dark:text-brand-400" onClick={() => patchScope({ affectedPopulation: [...(scope.affectedPopulation ?? []), { group: "", figure: "" }] })}>
                  + Add figure
                </button>
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Main needs (optional)" htmlFor="scopeNeeds" hint="One need per line.">
              <Textarea id="scopeNeeds" rows={3} value={(scope.needs ?? []).join("\n")} onChange={(e) => patchScope({ needs: e.target.value.split("\n") })} />
            </Field>
          </div>
        </div>
      )}

      {reportType === "CUSTOM" && (
        <div className="space-y-4">
          <Field label="Report title" htmlFor="scopeTitle" error={fields.title?.[0]}>
            <Input id="scopeTitle" value={scope.title ?? ""} onChange={(e) => patchScope({ title: e.target.value })} invalid={Boolean(fields.title)} />
          </Field>
          <Field label="Purpose (optional)" htmlFor="scopePurpose" hint="What this report is for and who will read it.">
            <Textarea id="scopePurpose" rows={3} value={scope.purpose ?? ""} onChange={(e) => patchScope({ purpose: e.target.value })} />
          </Field>
          <Field label="Sections (optional)" htmlFor="scopeSections" hint="List the sections you want. Leave empty for Background, Findings and Conclusions.">
            <div id="scopeSections" className="space-y-2">
              {(scope.sections ?? []).map((sec, i) => {
                const secs = scope.sections ?? [];
                const update = (patch: { title?: string; guidance?: string }) => patchScope({ sections: secs.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                const move = (to: number) => {
                  const next = [...secs];
                  const [item] = next.splice(i, 1);
                  next.splice(to, 0, item!);
                  patchScope({ sections: next });
                };
                return (
                  <div key={i} className="rounded-xl border border-slate-300 p-2 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <Input aria-label={`Section ${i + 1} title`} placeholder={`Section ${i + 1} title`} value={sec.title} onChange={(e) => update({ title: e.target.value })} />
                      <button type="button" className="text-xs text-slate-500 hover:underline disabled:opacity-40" disabled={i === 0} onClick={() => move(i - 1)} aria-label="Move section up">↑</button>
                      <button type="button" className="text-xs text-slate-500 hover:underline disabled:opacity-40" disabled={i === secs.length - 1} onClick={() => move(i + 1)} aria-label="Move section down">↓</button>
                      <button type="button" className="text-xs text-danger-700 hover:underline dark:text-danger-400" onClick={() => patchScope({ sections: secs.filter((_, j) => j !== i) })}>Remove</button>
                    </div>
                    <Input className="mt-2" aria-label={`Section ${i + 1} guidance`} placeholder="What should this section cover? (optional)" value={sec.guidance ?? ""} onChange={(e) => update({ guidance: e.target.value })} />
                  </div>
                );
              })}
              <button type="button" className="text-sm text-brand-600 hover:underline dark:text-brand-400" onClick={() => patchScope({ sections: [...(scope.sections ?? []), { title: "" }] })}>
                + Add section
              </button>
            </div>
          </Field>
        </div>
      )}
    </>
  );
}

/**
 * Drops the blank rows the editor keeps while typing (empty figure rows, empty
 * need lines, untitled sections) so the server only sees complete entries.
 */
export function cleanScope(scope: ReportScope): ReportScope {
  const out: ReportScope = { ...scope };
  const figures = (scope.affectedPopulation ?? []).filter((f) => f.group.trim() && f.figure.trim());
  const needs = (scope.needs ?? []).map((n) => n.trim()).filter(Boolean);
  const sections = (scope.sections ?? []).filter((x) => x.title.trim());
  if (figures.length > 0) out.affectedPopulation = figures; else delete out.affectedPopulation;
  if (needs.length > 0) out.needs = needs; else delete out.needs;
  if (sections.length > 0) out.sections = sections; else delete out.sections;
  return out;
}
