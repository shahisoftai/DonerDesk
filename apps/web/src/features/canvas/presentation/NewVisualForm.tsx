"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BUILT_IN_CANVAS_TEMPLATES, applyCanvasTemplate, type CanvasScope } from "@donordesk/domain/contexts/canvas/index.js";
import { createCanvasAction } from "@/lib/actions/canvas";
import { getDataSheetAction } from "@/lib/actions/data-charts";
import { GOALS, suggestRoles } from "../domain/guided";
import type { ProjectOption } from "./CanvasWorkspace";
import type { IndicatorOption } from "./editor/FieldWidget";

const SELECT = "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900";
const BLANK = "blank";

/** Start from a humanitarian template or from a blank page. A template names roles ("the headline indicator"); here the person chooses which indicator plays each. */
export function NewVisualForm({ projects, canShare }: { projects: ReadonlyArray<ProjectOption>; canShare: boolean }) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<string>(BUILT_IN_CANVAS_TEMPLATES[0]?.id ?? BLANK);
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<CanvasScope>(canShare ? "PROJECT" : "MINE");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [indicators, setIndicators] = useState<IndicatorOption[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const template = BUILT_IN_CANVAS_TEMPLATES.find((t) => t.id === templateId);

  async function chooseProject(id: string): Promise<void> {
    setProjectId(id); setRoles({});
    if (!id) { setIndicators([]); return; }
    const r = await getDataSheetAction(id);
    const list = r.ok ? r.value.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name })) : [];
    setIndicators(list);
    // Offered, never forced: a role is filled only where a word says the indicator fits, and the person can change it.
    if (template) setRoles(suggestRoles(template.roles, list));
  }

  function chooseTemplate(id: string): void {
    setTemplateId(id);
    const t = BUILT_IN_CANVAS_TEMPLATES.find((x) => x.id === id);
    setRoles(t ? suggestRoles(t.roles, indicators) : {});
  }

  async function create(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    const name = title.trim() || template?.title || "Untitled";
    const effectiveProject = scope === "PROJECT" || template ? projectId : "";
    if ((scope === "PROJECT" || template) && !effectiveProject) { setError("Choose the project this is about."); return; }
    setBusy(true);
    let pages;
    if (template) {
      const applied = applyCanvasTemplate(template, roles, { id: "new", title: name, scope, projectId: effectiveProject });
      if (!applied.ok) { setBusy(false); setError(`Choose the ${applied.needs.map((k) => template.roles.find((r) => r.key === k)?.label.toLowerCase() ?? k).join(" and ")}.`); return; }
      pages = applied.canvas.pages;
    }
    const r = await createCanvasAction({ title: name, scope, ...(scope === "PROJECT" ? { projectId: effectiveProject } : {}), ...(template ? { profile: template.canvas.profile, mode: template.canvas.mode, ...(pages ? { pages } : {}) } : {}) });
    if (!r.ok) { setBusy(false); setError(r.error.message); return; }
    router.push(`/visuals/${r.value.id}`);
  }

  return (
    <form onSubmit={(e) => void create(e)} className="grid gap-6 lg:grid-cols-[1fr_22rem]" data-testid="new-visual">
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-semibold">What do you want to do?</legend>
        <div className="flex flex-wrap gap-2" data-testid="goals">
          {GOALS.map((g) => (
            <button key={g.key} type="button" title={g.help} aria-pressed={templateId === g.templateId} onClick={() => chooseTemplate(g.templateId)}
              className={`rounded-full border px-3 py-1 text-sm ${templateId === g.templateId ? "border-sky-600 bg-sky-50 font-medium dark:bg-sky-950" : "border-slate-300 hover:border-slate-500 dark:border-slate-600"}`}>{g.label}</button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Or choose a starter below, or a blank page.</p>
        <p className="mb-1 mt-2 text-sm font-semibold">Start from</p>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Template">
          {[...BUILT_IN_CANVAS_TEMPLATES.map((t) => ({ id: t.id, title: t.title, description: t.description })), { id: BLANK, title: "A blank page", description: "Add blocks one at a time." }].map((t) => (
            <label key={t.id} className={`cursor-pointer rounded-lg border p-3 text-sm ${templateId === t.id ? "border-sky-600 bg-sky-50 dark:bg-sky-950" : "border-slate-200 hover:border-slate-400 dark:border-slate-700"}`}>
              <input type="radio" name="template" className="sr-only" checked={templateId === t.id} onChange={() => chooseTemplate(t.id)} />
              <span className="block font-semibold">{t.title}</span><span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">{t.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-4">
        <label className="block space-y-1 text-sm"><span className="font-medium">Name</span><input className={SELECT} value={title} placeholder={template?.title ?? "Untitled"} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
        <label className="block space-y-1 text-sm"><span className="font-medium">Who is it for</span>
          <select className={SELECT} value={scope} onChange={(e) => setScope(e.target.value as CanvasScope)}>
            <option value="MINE">Only me</option>{canShare && <option value="PROJECT">Everyone on one project</option>}{canShare && <option value="ORG">The whole organisation</option>}
          </select></label>
        {(scope === "PROJECT" || template) && (
          <label className="block space-y-1 text-sm"><span className="font-medium">Project</span>
            <select className={SELECT} value={projectId} onChange={(e) => void chooseProject(e.target.value)}><option value="">Choose a project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        )}
        {template && template.roles.length > 0 && indicators.length === 0 && projectId && <p className="text-xs text-slate-500">This project has no indicators yet; blocks that need one will be left out.</p>}
        {template?.roles.map((r) => (
          <label key={r.key} className="block space-y-1 text-sm"><span className="font-medium">{r.label}{r.required ? "" : " (optional)"}</span>
            <select className={SELECT} value={roles[r.key] ?? ""} onChange={(e) => setRoles({ ...roles, [r.key]: e.target.value })} disabled={!projectId}>
              <option value="">{projectId ? "None" : "Choose a project first"}</option>{indicators.map((i) => <option key={i.id} value={i.id}>{i.code} {i.name}</option>)}
            </select></label>
        ))}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50">{busy ? "Making it…" : "Make it"}</button>
      </div>
    </form>
  );
}
