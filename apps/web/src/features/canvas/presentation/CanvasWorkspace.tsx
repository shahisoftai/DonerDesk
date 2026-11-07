"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CANVAS_PROFILES, altPack, canPublish, canvasJson, canvasProblems, canvasToWidgets, checkCanvas, listThemes, type Canvas, type CanvasProblem } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { deleteCanvasAction, duplicateCanvasAction, previewCanvasAction, resolveCanvasAction, saveCanvasAction } from "@/lib/actions/canvas";
import type { CanvasView, ResolvedCanvas } from "@/lib/server/schemas-canvas";
import { blockLabelKey } from "../domain/canvas-copy";
import { BlockBoundary } from "./BlockBoundary";
import { downloadPicture } from "./download-picture";
import { CanvasBlockView } from "./CanvasBlockView";
import { BlockPalette } from "./editor/BlockPalette";
import type { IndicatorOption } from "./editor/FieldWidget";
import { Inspector } from "./editor/Inspector";
import { useCanvasEditor } from "./use-canvas-editor";

export interface ProjectOption { id: string; name: string }
interface Props { initial: CanvasView; resolved: ResolvedCanvas | null; resolveError: string | null; projects: ReadonlyArray<ProjectOption>; indicatorsByProject: Readonly<Record<string, ReadonlyArray<IndicatorOption>>> }

const PROFILE_LABEL: Record<(typeof CANVAS_PROFILES)[number], string> = { LIVE_INTERNAL: "Live, for the team", SNAPSHOT: "A snapshot to share", DONOR_REPORT: "For a donor", SOCIAL: "For social media", INTERNAL: "Internal document" };
const SCOPE_LABEL = { ORG: "Whole organisation", PROJECT: "One project", MINE: "Only me", PORTFOLIO: "Portfolio" } as const;
const SEVERITY = { BLOCKER: "Must fix", WARN: "Should fix", TIP: "Tip" } as const;
const BTN = "rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800";

function download(name: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/** Looking at a canvas and changing it. The same page is a live dashboard and, once its design check passes, an infographic to share. */
export function CanvasWorkspace({ initial, resolved: first, resolveError, projects, indicatorsByProject }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const ed = useCanvasEditor(initial.canvas, initial.projectId ?? projects[0]?.id);
  const menu = useRef<HTMLDetailsElement>(null);
  /** An action chosen from the menu closes it. */
  const choose = (action: () => void) => () => { menu.current?.removeAttribute("open"); action(); };
  const [editing, setEditing] = useState(false);
  const [resolved, setResolved] = useState(first);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(resolveError ? { tone: "error", text: resolveError } : null);
  const [serverProblems, setServerProblems] = useState<CanvasProblem[]>([]);
  const base = useRef({ revision: initial.canvas.revision, json: "" });
  const snapshot = useCallback((c: Canvas) => JSON.stringify({ t: c.title, p: c.profile, th: c.themeId, l: c.language, m: c.mode, pages: c.pages }), []);
  if (base.current.json === "") base.current.json = snapshot(initial.canvas);

  const canvas = ed.canvas;
  const dirty = snapshot(canvas) !== base.current.json;
  const savedBlocks = useRef(new Map(initial.canvas.pages.flatMap((p) => p.blocks).map((b) => [b.id, JSON.stringify(b.props) + JSON.stringify(b.bindings)])));
  // An edited, unsaved canvas is read again as the person works (after a short pause), so each change shows its real figures at once.
  const [preview, setPreview] = useState<{ sig: string; value: ResolvedCanvas } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const sig = useMemo(() => JSON.stringify({ t: canvas.title, th: canvas.themeId, l: canvas.language, m: canvas.mode, pages: canvas.pages, o: canvas.options }), [canvas]);
  const savedSig = useRef(sig);
  useEffect(() => {
    if (!dirty) { setPreview(null); setPreviewError(null); savedSig.current = sig; return; }
    let current = true;
    const timer = setTimeout(async () => {
      const r = await previewCanvasAction({ title: canvas.title, pages: canvas.pages, profile: canvas.profile, mode: canvas.mode, language: canvas.language, themeId: canvas.themeId, ...(canvas.options ? { options: canvas.options } : {}), ...(initial.projectId ? { projectId: initial.projectId } : {}) });
      if (!current) return;
      if (r.ok) { setPreview({ sig, value: r.value }); setPreviewError(null); } else setPreviewError(r.error.message);
    }, 350);
    return () => { current = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, dirty]);
  const live = dirty && preview ? preview.value : resolved;
  const previewCurrent = !dirty || preview?.sig === sig;
  const widgets = useMemo(() => new Map(canvasToWidgets(canvas, initial.projectId).widgets.map((w) => [w.id, w])), [canvas, initial.projectId]);
  const drawings = useMemo(() => new Map((live?.drawings ?? []).map((d) => [d.widgetId, d])), [live]);
  const problems = useMemo(() => canvasProblems(canvas), [canvas]);
  const findings = useMemo(() => checkCanvas(canvas), [canvas]);
  const canEdit = initial.canEdit;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent): void => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save(): Promise<void> {
    setBusy("save"); setNotice(null);
    const r = await saveCanvasAction(initial.id, { expectedRevision: base.current.revision, title: canvas.title, pages: canvas.pages, profile: canvas.profile, mode: canvas.mode, language: canvas.language, themeId: canvas.themeId, ...(canvas.options ? { options: canvas.options } : {}) });
    if (!r.ok) { setBusy(null); setNotice({ tone: "error", text: r.error.message }); return; }
    const saved = r.value.canvas.canvas;
    base.current = { revision: saved.revision, json: snapshot(canvas) };
    savedBlocks.current = new Map(canvas.pages.flatMap((p) => p.blocks).map((b) => [b.id, JSON.stringify(b.props) + JSON.stringify(b.bindings)]));
    ed.adoptRevision(saved.revision);
    setServerProblems(r.value.problems);
    const fresh = await resolveCanvasAction(initial.id);
    if (fresh.ok) setResolved(fresh.value);
    setBusy(null);
    setNotice({ tone: "ok", text: r.value.problems.length ? `Saved. ${r.value.problems.length} block${r.value.problems.length === 1 ? " is" : "s are"} not set up yet.` : "Saved." });
  }

  async function copy(): Promise<void> {
    setBusy("copy");
    const r = await duplicateCanvasAction(initial.id);
    setBusy(null);
    if (r.ok) router.push(`/visuals/${r.value.id}`); else setNotice({ tone: "error", text: r.error.message });
  }

  async function remove(): Promise<void> {
    if (!window.confirm(`Delete "${canvas.title}"? This cannot be undone.`)) return;
    setBusy("delete");
    const r = await deleteCanvasAction(initial.id);
    if (r.ok) router.push("/visuals"); else { setBusy(null); setNotice({ tone: "error", text: r.error.message }); }
  }

  const label = (kind: string): string => t(blockLabelKey(kind as never));
  const blocks = ed.page.blocks;
  const selectedProblems = [...problems, ...serverProblems.filter((s) => !problems.some((p) => p.blockId === s.blockId && p.message === s.message))];

  return (
    <div className="space-y-4" data-testid="canvas-workspace" data-editing={editing || undefined}>
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          {editing ? <input aria-label="Name" className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xl font-semibold dark:border-slate-600 dark:bg-slate-900" value={canvas.title} onChange={(e) => ed.rename(e.target.value)} /> : <h1 className="truncate text-xl font-semibold tracking-tight">{canvas.title}</h1>}
          <p className="text-xs text-slate-500">{SCOPE_LABEL[initial.scope]} · {canvas.mode === "LIVE" ? "Live: figures are read when you open it" : "Published: a design to share"}{initial.sourceKind ? ` · from an older ${initial.sourceKind.toLowerCase()}` : ""}{dirty ? " · Unsaved changes" : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {canEdit && <button type="button" className={BTN} aria-pressed={editing} onClick={() => setEditing((v) => !v)}>{editing ? "Done editing" : "Edit"}</button>}
          {editing && <><button type="button" className={BTN} onClick={ed.undo} disabled={!ed.canUndo}>Undo</button><button type="button" className={BTN} onClick={ed.redo} disabled={!ed.canRedo}>Redo</button></>}
          {canEdit && <button type="button" className={`${BTN} bg-sky-700 text-white hover:bg-sky-800 dark:hover:bg-sky-800`} onClick={() => void save()} disabled={!dirty || busy !== null}>{busy === "save" ? "Saving…" : "Save"}</button>}
          <details className="relative" ref={menu}>
            <summary className={`${BTN} cursor-pointer list-none`}>More</summary>
            <ul className="absolute end-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => void downloadPicture(document.querySelector<HTMLElement>('[data-testid="canvas-grid"]'), canvas.title).then((r) => setNotice(r.ok ? { tone: "ok", text: "Picture saved to your downloads." } : { tone: "error", text: r.message })))}>Download as a picture</button></li>
              <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => window.print())}>Print or save as PDF</button></li>
              <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => download(`${canvas.title}.canvas.json`, "application/json", canvasJson(canvas)))}>Download the canvas file</button></li>
              <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => download(`${canvas.title}-descriptions.txt`, "text/plain", altPack(canvas)))}>Download descriptions and captions</button></li>
              <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => void copy())} disabled={busy !== null}>Make a copy for me</button></li>
              {canEdit && <li><button type="button" className="block w-full px-3 py-1.5 text-start text-red-700 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => void remove())} disabled={busy !== null}>Delete</button></li>}
            </ul>
          </details>
        </div>
      </header>

      {notice && <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded px-3 py-2 text-sm print:hidden ${notice.tone === "error" ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"}`}>{notice.text}</p>}
      {previewError && editing && <p role="status" className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden dark:bg-amber-950 dark:text-amber-100">The figures could not be refreshed while you edit: {previewError}</p>}
      {ed.message && <p role="alert" className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden dark:bg-amber-950 dark:text-amber-100">{ed.message} <button type="button" className="underline" onClick={ed.clearMessage}>Dismiss</button></p>}

      {editing && (
        <section className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-3 text-sm print:hidden dark:border-slate-700" aria-label="About this canvas">
          <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">What it is for</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={canvas.profile} onChange={(e) => ed.setMeta({ profile: e.target.value as Canvas["profile"] })}>{CANVAS_PROFILES.map((p) => <option key={p} value={p}>{PROFILE_LABEL[p]}</option>)}</select></label>
          <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">Look</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={canvas.themeId} onChange={(e) => ed.setMeta({ themeId: e.target.value })}>{listThemes().map((th) => <option key={th.id} value={th.id}>{th.label}</option>)}</select></label>
          <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">Language</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={canvas.language} onChange={(e) => ed.setMeta({ language: e.target.value })}>{[["en", "English"], ["fr", "Français"], ["es", "Español"], ["ar", "العربية"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">Kind</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={canvas.mode} onChange={(e) => ed.setMeta({ mode: e.target.value as Canvas["mode"] })}><option value="LIVE">Live dashboard</option><option value="PUBLISHED_ONLY">Infographic to share</option></select></label>
        </section>
      )}

      <nav aria-label="Pages" className="flex flex-wrap items-center gap-1 print:hidden">
        {canvas.pages.map((p) => <button key={p.id} type="button" aria-current={p.id === ed.page.id ? "page" : undefined} onClick={() => { ed.setPageId(p.id); ed.setSelected(null); }} className={`rounded-t border-b-2 px-3 py-1.5 text-sm ${p.id === ed.page.id ? "border-sky-600 font-semibold" : "border-transparent text-slate-600 hover:border-slate-300"}`}>{p.title || "Page"}</button>)}
        {editing && <button type="button" className="px-2 py-1 text-sm text-sky-700 underline" onClick={ed.addPage}>Add a page</button>}
        {editing && <label className="ms-3 flex items-center gap-1 text-xs">Rename<input aria-label="Page name" className="rounded border border-slate-300 bg-white px-1 py-0.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={ed.page.title} onChange={(e) => ed.renamePage(ed.page.id, e.target.value)} /></label>}
        {editing && canvas.pages.length > 1 && <button type="button" className="ms-2 text-xs text-red-700 underline" onClick={() => ed.removePage(ed.page.id)}>Remove this page</button>}
      </nav>

      <div className={editing ? "grid gap-4 lg:grid-cols-[1fr_20rem]" : ""}>
        <div>
          {blocks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{editing ? "This page is empty. Add a block from the list on the right." : canEdit ? "This page is empty. Choose Edit to add blocks." : "This page is empty."}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:auto-rows-[5.5rem]" dir={canvas.language === "ar" ? "rtl" : "ltr"} data-testid="canvas-grid">
              {blocks.map((b) => (
                <div key={b.id} className="h-[var(--mh)] sm:h-auto sm:[grid-column:var(--c)/span_var(--w)] sm:[grid-row:var(--r)/span_var(--h)]" style={{ "--c": b.bounds.x + 1, "--w": b.bounds.w, "--r": b.bounds.y + 1, "--h": b.bounds.h, "--mh": `${Math.max(b.bounds.h, 1) * 5.5}rem` } as React.CSSProperties}>
                  <BlockBoundary label={label(b.kind)}><CanvasBlockView block={b} canvas={canvas} drawing={drawings.get(b.id)} widget={widgets.get(b.id)} serverModel={live?.models[b.id]} changed={!previewCurrent && savedBlocks.current.get(b.id) !== JSON.stringify(b.props) + JSON.stringify(b.bindings)} selected={ed.selected === b.id} editing={editing} onSelect={() => ed.setSelected(b.id)} /></BlockBoundary>
                </div>
              ))}
            </div>
          )}

          <section className="mt-4 space-y-2 print:hidden" aria-label="Design check">
            <details>
              <summary className="cursor-pointer text-sm font-medium">Design check: {findings.length === 0 && problems.length === 0 ? "nothing to fix" : `${findings.length + problems.length} thing${findings.length + problems.length === 1 ? "" : "s"} to look at`}{canvas.mode === "PUBLISHED_ONLY" ? (canPublish(findings) && problems.length === 0 ? " · ready to share" : " · not ready to share") : ""}</summary>
              <ul className="mt-2 space-y-1 text-sm">
                {problems.map((p, i) => <li key={`p${i}`}><span className="font-medium text-amber-800">Not set up</span> · {p.blockId ? `${label(canvas.pages.flatMap((pg) => pg.blocks).find((b) => b.id === p.blockId)?.kind ?? "")}: ` : ""}{p.message}</li>)}
                {findings.map((f, i) => <li key={`f${i}`}><span className={`font-medium ${f.severity === "BLOCKER" ? "text-red-700" : "text-amber-800"}`}>{SEVERITY[f.severity]}</span> · {f.message}</li>)}
              </ul>
            </details>
          </section>
        </div>

        {editing && (
          <div className="space-y-4 print:hidden">
            {ed.selectedBlock ? <Inspector block={ed.selectedBlock} label={label(ed.selectedBlock.kind)} projects={projects} indicatorsByProject={indicatorsByProject} fallbackProjectId={initial.projectId} problems={selectedProblems}
              onProps={(p) => ed.setProps(ed.selectedBlock!.id, p)} onProject={(pid) => ed.setProject(ed.selectedBlock!.id, pid)} onBounds={(c) => ed.bounds(ed.selectedBlock!.id, c)} onAlt={(a, d) => ed.alt(ed.selectedBlock!.id, a, d)} onAction={(a) => ed.act(ed.selectedBlock!.id, a)} />
              : <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-500 dark:border-slate-700">Select a block to change it, or add one below.</p>}
            <BlockPalette onAdd={ed.add} />
          </div>
        )}
      </div>
    </div>
  );
}

