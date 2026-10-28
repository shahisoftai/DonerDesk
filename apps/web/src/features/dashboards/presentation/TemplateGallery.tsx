"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardTemplate, ProjectIndicatorFacts } from "@donordesk/domain/contexts/dashboards/dashboard-templates.js";
import { copyTemplate } from "@donordesk/domain/contexts/dashboards/dashboard-templates.js";
import { applyDashboardTemplateAction, getDashboardTemplateAction, saveDashboardTemplateAction } from "@/lib/actions/dashboards";
import { getDataSheetAction } from "@/lib/actions/data-charts";
import type { TemplateApplied, TemplateSummary } from "@/lib/server/schemas-dashboards";
import { choose, initialChoices, previewApply, type RoleChoices } from "../domain/template-apply";

const AUDIENCE = { PROGRAMME: "Programme team", DONOR: "Donor view", FIELD: "Field and partners", EXECUTIVE: "Executive" } as const;
const btn = "btn-secondary px-3 py-1.5 text-sm";
const input = "input px-2 py-1 text-sm";

interface Open { summary: TemplateSummary; template: DashboardTemplate; indicators: Array<ProjectIndicatorFacts & { unit?: string | undefined }>; choices: RoleChoices; projectId: string }

/** The templates by sector. "Use" asks which indicator answers each role (suggested, never guessed) and makes the dashboard; "Copy and edit" makes the organisation's own copy. */
export function TemplateGallery({ templates, projects, canEdit }: { templates: TemplateSummary[]; projects: Array<{ id: string; name: string }>; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<Open | null>(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"MINE" | "PROJECT">("MINE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<TemplateApplied | null>(null);

  const bySector = new Map<string, TemplateSummary[]>();
  for (const t of templates) bySector.set(t.sectorLabel, [...(bySector.get(t.sectorLabel) ?? []), t]);

  async function loadProject(summary: TemplateSummary, template: DashboardTemplate, projectId: string) {
    const sheet = await getDataSheetAction(projectId);
    const indicators = sheet.ok ? sheet.value.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name, type: i.type, isRate: i.isRate, unit: i.unit })) : [];
    setOpen({ summary, template, indicators, choices: initialChoices(template, indicators), projectId });
  }
  async function use(s: TemplateSummary) {
    setError(null); setApplied(null); setBusy(true);
    const detail = await getDashboardTemplateAction(s.id);
    setBusy(false);
    if (!detail.ok) { setError(detail.error.message); return; }
    const projectId = projects[0]?.id ?? "";
    setName(s.title);
    if (!projectId) { setError("You have no project to make a dashboard for."); return; }
    await loadProject(s, detail.value.template as unknown as DashboardTemplate, projectId);
  }
  async function copy(s: TemplateSummary) {
    setError(null); setBusy(true);
    const detail = await getDashboardTemplateAction(s.id);
    if (!detail.ok) { setBusy(false); setError(detail.error.message); return; }
    const t = copyTemplate(detail.value.template as unknown as DashboardTemplate, { id: "new" });
    const saved = await saveDashboardTemplateAction({ title: t.title, description: t.description, sector: t.sector, audience: t.audience, roles: t.roles, widgets: t.widgets, basedOn: s.id });
    setBusy(false);
    if (!saved.ok) { setError(saved.error.message); return; }
    router.push(`/dashboards/templates/${saved.value.id}`);
  }
  async function create() {
    if (!open) return;
    setBusy(true); setError(null);
    const r = await applyDashboardTemplateAction(open.summary.id, { projectId: open.projectId, name, scope, mapping: open.choices });
    setBusy(false);
    if (!r.ok) { setError(r.error.message); return; }
    setApplied(r.value);
  }

  const preview = open ? previewApply(open.template, open.choices) : null;

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
      {[...bySector].map(([sector, list]) => (
        <section key={sector} className="space-y-2" aria-label={sector}>
          <h2 className="text-base font-semibold">{sector}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {list.map((t) => (
              <li key={t.id} className="card space-y-2" data-template={t.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{t.title}</h3>
                  <span className="rounded-full border px-2 py-0.5 text-[11px]">{t.origin === "BUILT_IN" ? "Draft template" : "Your template"}</span>
                  <span className="rounded-full border px-2 py-0.5 text-[11px]">{AUDIENCE[t.audience]}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{t.description}</p>
                <p className="text-xs text-slate-500">{t.chartCount} chart{t.chartCount === 1 ? "" : "s"} · {t.roleCount} indicator role{t.roleCount === 1 ? "" : "s"}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btn} onClick={() => void use(t)} disabled={busy}>Use this template</button>
                  {canEdit && t.origin === "BUILT_IN" && <button type="button" className={btn} onClick={() => void copy(t)} disabled={busy}>Copy and edit</button>}
                  {canEdit && t.origin === "ORGANISATION" && <a className={btn} href={`/dashboards/templates/${t.id}`}>Edit</a>}
                  {t.origin === "BUILT_IN" && <a className="px-1 py-1.5 text-sm underline" href={`/dashboards/templates/${t.id}`}>Look inside</a>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {open && !applied && (
        <section className="card space-y-3" aria-label={`Use ${open.summary.title}`} data-testid="apply-panel">
          <h2 className="text-base font-semibold">Make a dashboard from &ldquo;{open.summary.title}&rdquo;</h2>
          <div className="flex flex-wrap gap-3">
            <label className="text-xs">Project<select aria-label="Project" className={`${input} block`} value={open.projectId} onChange={(e) => void loadProject(open.summary, open.template, e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="text-xs">Name<input aria-label="Dashboard name" className={`${input} block`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
            <label className="text-xs">Who sees it<select aria-label="Who sees it" className={`${input} block`} value={scope} onChange={(e) => setScope(e.target.value === "PROJECT" ? "PROJECT" : "MINE")}><option value="MINE">Only me</option>{canEdit && <option value="PROJECT">Everyone on the project</option>}</select></label>
          </div>
          <p className="text-sm">Which of the project&apos;s indicators answers each of these? Leave one empty if none does: charts that need it are left out, never drawn from a guess.</p>
          <ul className="space-y-2">
            {open.template.roles.map((r) => {
              const fits = open.indicators;
              return (
                <li key={r.key} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                  <span className="text-sm"><span className="font-medium">{r.label}</span>{r.required ? <span className="text-slate-500"> (needed)</span> : null}<span className="block text-xs text-slate-500">{r.hint}</span></span>
                  <select aria-label={r.label} className={input} value={open.choices[r.key] ?? ""} onChange={(e) => setOpen({ ...open, choices: choose(open.choices, r.key, e.target.value || null) })}>
                    <option value="">— none —</option>
                    {fits.map((i) => <option key={i.id} value={i.id}>{i.code} {i.name}{i.unit ? ` (${i.unit})` : ""}</option>)}
                  </select>
                </li>
              );
            })}
          </ul>
          {preview && (
            <p role="status" className="text-sm" data-testid="apply-preview">
              {preview.drawable} chart{preview.drawable === 1 ? "" : "s"} can be drawn now.
              {preview.leftOut.length > 0 ? ` Left out until chosen: ${preview.leftOut.map((l) => l.title).join(", ")}.` : ""}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn px-3 py-1.5 text-sm" onClick={() => void create()} disabled={busy || !name.trim() || (preview?.drawable ?? 0) === 0}>Create the dashboard</button>
            <button type="button" className={btn} onClick={() => setOpen(null)}>Cancel</button>
          </div>
        </section>
      )}

      {applied && (
        <p role="status" data-testid="applied" className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-500/10">
          Your dashboard is ready. <a className="underline" href={`/dashboards/${applied.dashboardId}`}>Open it</a>.
          {applied.chartsLeftOut.length > 0 ? ` ${applied.chartsLeftOut.length} chart${applied.chartsLeftOut.length === 1 ? " was" : "s were"} left out because ${applied.chartsLeftOut.length === 1 ? "it needs" : "they need"} an indicator you did not choose.` : ""}
        </p>
      )}
    </div>
  );
}
