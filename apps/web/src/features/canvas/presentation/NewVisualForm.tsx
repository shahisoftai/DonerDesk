"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BUILT_IN_CANVAS_TEMPLATES, DEFAULT_PAGE_FORMAT, compactRows, FRAME_PRESETS, PAGE_PRESETS, STANDARD_TEMPLATE_IDS, pagePresetById, applyCanvasTemplate, setPagePreset, type Canvas, type CanvasScope } from "@donordesk/domain/contexts/canvas/index.js";
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
  /** The page a new visual starts on: a free page by default, where every block goes where it is put and any size is allowed. */
  const [pageChoice, setPageChoice] = useState<string | null>(null);
  /** The look of every block: the flat title bar by default (the common look of humanitarian dashboards); any block can be changed afterwards. */
  const [blockLook, setBlockLook] = useState<string>("flatBar");
  const [moreSearch, setMoreSearch] = useState("");
  const template = BUILT_IN_CANVAS_TEMPLATES.find((t) => t.id === templateId);
  // A starter written for a printed page keeps that page; otherwise a new visual is a free dashboard page.
  const templatePage = template?.canvas.pages[0]?.format;
  const automaticFormat = templatePage && pagePresetById(templatePage)?.mode === "FREE" ? templatePage : DEFAULT_PAGE_FORMAT;
  const pageFormat = pageChoice ?? automaticFormat;
  const standard = BUILT_IN_CANVAS_TEMPLATES.filter((t) => STANDARD_TEMPLATE_IDS.includes(t.id));
  const more = BUILT_IN_CANVAS_TEMPLATES.filter((t) => !STANDARD_TEMPLATE_IDS.includes(t.id) && (moreSearch.trim() === "" || `${t.title} ${t.description}`.toLowerCase().includes(moreSearch.trim().toLowerCase())));

  async function chooseProject(id: string): Promise<void> {
    setProjectId(id); setRoles({});
    if (!id) { setIndicators([]); return; }
    const r = await getDataSheetAction(id);
    const list = r.ok ? r.value.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name })) : [];
    setIndicators(list);
    // Offered, never forced: a role is filled only where a word says the indicator fits, and the person can change it.
    if (template) setRoles(suggestRoles(template.roles, list));
  }

  // The project shown first is chosen already: its indicators are read now, so the roles can be suggested and the data is there from the start.
  useEffect(() => { if (projectId) void chooseProject(projectId); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // A template names roles; none is required of the person. A role they left empty is offered the project's next unused indicator, and every block can be changed afterwards from the data panel.
      const filled: Record<string, string> = { ...roles };
      const used = new Set(Object.values(filled).filter(Boolean));
      for (const r of template.roles) { if (!filled[r.key]) { const next = indicators.find((i) => !used.has(i.id)); if (next && r.required) { filled[r.key] = next.id; used.add(next.id); } } }
      const applied = applyCanvasTemplate(template, filled, { id: "new", title: name, scope, projectId: effectiveProject });
      if (!applied.ok) { setBusy(false); setError(`Choose the ${applied.needs.map((k) => template.roles.find((r) => r.key === k)?.label.toLowerCase() ?? k).join(" and ")}.`); return; }
      // A block left out (its indicator was not chosen) leaves no empty band: the rows below move up before the page is laid out freely.
      const compacted: Canvas = { ...applied.canvas, pages: applied.canvas.pages.map((pg) => {
        const top = pg.blocks.filter((b) => !b.container);
        const moved = new Map(compactRows(top.map((b) => ({ id: b.id, ...b.bounds }))).map((m) => [m.id, m.y]));
        return { ...pg, blocks: pg.blocks.map((b) => (moved.has(b.id) ? { ...b, bounds: { ...b.bounds, y: moved.get(b.id)! } } : b)) };
      }) };
      let laid: Canvas = compacted;
      // Every page takes the chosen page size as a free page; blocks keep their relative places.
      for (const pg of compacted.pages) { const moved = setPagePreset(laid, pg.id, pageFormat); if (moved.ok) laid = moved.canvas; }
      // Every block takes the chosen look (a block can still be changed on its own).
      pages = laid.pages.map((pg) => ({ ...pg, blocks: pg.blocks.map((b) => (b.container || blockLook === "none" ? b : { ...b, style: { ...b.style, frame: blockLook } })) }));
    }
    const r = await createCanvasAction({ title: name, scope, ...(scope === "PROJECT" ? { projectId: effectiveProject } : {}), ...(blockLook !== "none" ? { options: { blockFrame: blockLook } } : {}), ...(template ? { profile: template.canvas.profile, mode: template.canvas.mode, ...(pages ? { pages } : {}) } : { format: pageFormat }) });
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
              className={`rounded-full border px-3 py-1 text-sm ${templateId === g.templateId ? "border-brand-600 bg-brand-50 font-medium dark:bg-brand-950" : "border-slate-300 hover:border-slate-500 dark:border-slate-600"}`}>{g.label}</button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Or choose a starter below, or a blank page.</p>
        <p className="mb-1 mt-2 text-sm font-semibold">Start from</p>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Template">
          {[...standard.map((t) => ({ id: t.id, title: t.title, description: t.description })), { id: BLANK, title: "A blank page", description: "Start with all of your project's data on the side and add anything." }].map((t) => (
            <label key={t.id} className={`cursor-pointer rounded-lg border p-3 text-sm ${templateId === t.id ? "border-brand-600 bg-brand-50 dark:bg-brand-950" : "border-slate-200 hover:border-slate-400 dark:border-slate-700"}`}>
              <input type="radio" name="template" className="sr-only" checked={templateId === t.id} onChange={() => chooseTemplate(t.id)} />
              <span className="block font-semibold">{t.title}</span><span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">{t.description}</span>
            </label>
          ))}
        </div>
        <details className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700" data-testid="more-templates">
          <summary className="cursor-pointer font-medium">More templates ({BUILT_IN_CANVAS_TEMPLATES.length - standard.length})</summary>
          <input type="search" aria-label="Search templates" placeholder="Search by sector or purpose" value={moreSearch} onChange={(e) => setMoreSearch(e.target.value)} className={`${SELECT} mt-2`} />
          <div className="mt-2 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2" role="radiogroup" aria-label="More templates">
            {more.slice(0, 80).map((t) => (
              <label key={t.id} className={`cursor-pointer rounded border p-2 text-xs ${templateId === t.id ? "border-brand-600 bg-brand-50 dark:bg-brand-950" : "border-slate-200 hover:border-slate-400 dark:border-slate-700"}`}>
                <input type="radio" name="template" className="sr-only" checked={templateId === t.id} onChange={() => chooseTemplate(t.id)} />
                <span className="block font-semibold">{t.title}</span>
              </label>
            ))}
            {more.length > 80 && <p className="col-span-full text-xs text-slate-500">Showing 80 of {more.length}. Narrow the search.</p>}
          </div>
        </details>
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
        <label className="block space-y-1 text-sm"><span className="font-medium">Page size</span>
          <select className={SELECT} value={pageFormat} onChange={(e) => setPageChoice(e.target.value)} data-testid="page-size">
            {PAGE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}{p.size ? ` (${p.size.w} × ${p.size.h})` : ""}</option>)}
          </select><span className="block text-xs text-slate-500">Any size can be changed later, and every block can be placed and sized freely.</span></label>
        <label className="block space-y-1 text-sm"><span className="font-medium">Look of the blocks</span>
          <select className={SELECT} value={blockLook} onChange={(e) => setBlockLook(e.target.value)} data-testid="block-look">
            <option value="none">Plain (each block as designed)</option>
            {Object.entries(FRAME_PRESETS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
          </select></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="rounded bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">{busy ? "Making it…" : "Make it"}</button>
      </div>
    </form>
  );
}
