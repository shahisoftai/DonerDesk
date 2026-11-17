"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CANVAS_PROFILES, convertBlock, setFlag, altPack, definitionFor, canPublish, NO_FILTER, drillUp, isContainerKind, canvasAsDesign, canvasJson, isFiltered, pickToFilter, canvasThemeOf, type CrossFilter, canvasProblems, canvasToWidgets, checkCanvas, type Canvas, type CanvasProblem } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { deleteCanvasAction, duplicateCanvasAction, previewCanvasAction, resolveCanvasAction, saveCanvasAction, subscribeCanvasAction } from "@/lib/actions/canvas";
import type { CanvasView, ResolvedCanvas } from "@/lib/server/schemas-canvas";
import { useCanvasPreview } from "./useCanvasPreview";
import { BTN, FILE_FORMATS, PROFILE_LABEL, SCOPE_LABEL, SEVERITY, download } from "./workspace-labels";
import { blockLabelKey } from "../domain/canvas-copy";
import { BlockFrame } from "./BlockFrame";
import { downloadPicture } from "./download-picture";
import { CanvasPageGrid } from "./CanvasPageGrid";
import type { IndicatorOption } from "./editor/FieldWidget";
import { Inspector } from "./editor/Inspector";
import { PublishPanel } from "./PublishPanel";
import { CommandPalette } from "./CommandPalette";
import { ConvertDialog } from "./ConvertDialog";
import { LayersPanel } from "./LayersPanel";
import { ShortcutSheet } from "./ShortcutSheet";
import { ThemePicker } from "./ThemePicker";
import { PageLayoutPanel } from "./PageLayoutPanel";
import { FrameFields } from "./FrameFields";
import { isPicture, uploadPicture } from "../domain/media";
import { ThemeFileControl } from "./ThemeFileControl";
import { useEditorSession } from "./use-editor-session";
import { selectByRectangle } from "../domain/command-handlers";
import { VersionsPanel } from "./VersionsPanel";
import { useCanvasEditor } from "./use-canvas-editor";
import { usePresent } from "./use-present";
import { EditorTour } from "./EditorTour";
import { PresenceChips } from "./PresenceChips";
import { usePresence } from "./use-presence";
import { tablesCsv, tablesOfDrawings } from "../domain/data-tables";
import { EditorDrawers } from "../editor/presentation/EditorDrawers";
import { useDrawerPrefs } from "../editor/presentation/use-drawer-prefs";
import { pinnedWidth } from "../editor/domain/drawer-state";
import { BLOCK_DRAG_TYPE } from "../editor/presentation/AddDrawer";
import { pointToCell } from "../editor/domain/drop-cell";
import { FilterPane, type FilterBarProps } from "../filters/FilterPane";
import { FilterSlotProvider } from "../filters/filter-slot";
import { BlockEditProvider } from "@/components/editing/block-edit-context";
import { useFilterAddress } from "../filters/use-filter-address";
import { DatasetFilterProvider, type DatasetFilterApi } from "../filters/dataset-filters";
import { DatasetMapProvider } from "@/features/datasets/presentation/dataset-map-slot";
import { DatasetMapView } from "@/features/datasets/presentation/DatasetMapView";
import { toggleDatasetFilter, datasetFilterValues } from "@donordesk/domain/contexts/canvas/index.js";

export interface ProjectOption { id: string; name: string }
interface Props { /** How often the person is emailed that this is ready to open. */ subscription: "NONE" | "WEEKLY" | "MONTHLY"; initial: CanvasView; resolved: ResolvedCanvas | null; resolveError: string | null; projects: ReadonlyArray<ProjectOption>; indicatorsByProject: Readonly<Record<string, ReadonlyArray<IndicatorOption>>> }

/** Looking at a canvas and changing it. The same page is a live dashboard and, once its design check passes, an infographic to share. */
export function CanvasWorkspace({ subscription, initial, resolved: first, resolveError, projects, indicatorsByProject }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const ed = useCanvasEditor(initial.canvas, initial.projectId, projects[0]?.id);
  const menu = useRef<HTMLDetailsElement>(null);
  const saveRef = useRef<() => void>(() => undefined);
  const [convertId, setConvertId] = useState<string | null>(null);
  /** An action chosen from the menu closes it. */
  const choose = (action: () => void) => () => { menu.current?.removeAttribute("open"); action(); };
  const [editing, setEditing] = useState(false);
  const [drawers, setDrawers] = useDrawerPrefs();
  const [recent, setRecent] = useState<string[]>([]);
  const [resolved, setResolved] = useState(first);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(resolveError ? { tone: "error", text: resolveError } : null);
  const [reviewNow, setReviewNow] = useState(initial.reviewStatus);
  const [filters, setFilters] = useState<CrossFilter>(NO_FILTER);
  const [paneOpen, setPaneOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(subscription);
  async function subscribe(every: "NONE" | "WEEKLY" | "MONTHLY"): Promise<void> {
    const r = await subscribeCanvasAction(initial.id, every);
    if (!r.ok) { setNotice({ tone: "error", text: r.error.message }); return; }
    setSubscribed(every);
    setNotice({ tone: "ok", text: every === "NONE" ? t("canvas.ui.subRemoved") : t("canvas.ui.subSet") });
  }
  const [serverProblems, setServerProblems] = useState<CanvasProblem[]>([]);
  const base = useRef({ revision: initial.canvas.revision, json: "" });
  const snapshot = useCallback((c: Canvas) => JSON.stringify({ t: c.title, p: c.profile, th: c.themeId, l: c.language, m: c.mode, pages: c.pages }), []);
  if (base.current.json === "") base.current.json = snapshot(initial.canvas);

  const canvas = ed.canvas;
  const stage = useRef<HTMLDivElement>(null);
  const peers = usePresence(initial.id, ed.selection.ids[0] ?? null, editing);
  const present = usePresent(stage, canvas.pages.map((pg) => pg.id), ed.page.id, (id) => { ed.setPageId(id); ed.setSelected(null); });
  const dirty = snapshot(canvas) !== base.current.json;
  const savedBlocks = useRef(new Map(initial.canvas.pages.flatMap((p) => p.blocks).map((b) => [b.id, JSON.stringify(b.props) + JSON.stringify(b.bindings)])));
  const { live, previewCurrent, previewError } = useCanvasPreview({ canvas, id: initial.id, projectId: initial.projectId, filters, dirty, resolved, setResolved });
  const widgets = useMemo(() => new Map(canvasToWidgets(canvas, initial.projectId).widgets.map((w) => [w.id, w])), [canvas, initial.projectId]);
  const drawings = useMemo(() => new Map((live?.drawings ?? []).map((d) => [d.widgetId, d])), [live]);
  /** What the page shows as tables, ready to download (a picture that is not a table, such as a map, is left out). */
  const dataTables = useMemo(() => tablesOfDrawings(live?.drawings ?? []), [live]);
  async function downloadWorkbook(): Promise<void> {
    const response = await fetch("/api/canvases/data-workbook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: ed.canvas.title || "visual", tables: dataTables }) });
    if (!response.ok) { setNotice({ tone: "error", text: "The workbook could not be made. Try again." }); return; }
    const url = URL.createObjectURL(await response.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: `${ed.canvas.title || "visual"}-data.xlsx` });
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  const problems = useMemo(() => canvasProblems(canvas), [canvas]);
  const findings = useMemo(() => checkCanvas(canvas), [canvas]);
  // The page's own filter bar block (Phase 50.3): its settings decide which slicers show and how; the address keeps the choice (?f=).
  const filterBar = useMemo(() => (ed.page.blocks.find((b) => definitionFor(b.kind)?.family === "CONTROLS" && b.style?.hidden !== true)?.props ?? null) as FilterBarProps | null, [ed.page.blocks]);
  const pageTheme = useMemo(() => canvasThemeOf(canvas), [canvas]);
  useFilterAddress(filters, setFilters);
  const hasFilterBar = useMemo(() => canvas.pages.some((p) => p.blocks.some((b) => definitionFor(b.kind)?.family === "CONTROLS" && b.style?.hidden !== true)), [canvas]);
  const leftOut = useMemo(() => canvasAsDesign(canvas).skipped, [canvas]);
  const canEdit = initial.canEdit;
  const projectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const session = useEditorSession(ed, { enabled: editing, save: () => saveRef.current(), preview: () => setEditing(false), canReachProject: (id) => projectIds.has(id), convert: setConvertId });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent): void => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save(): Promise<void> {
    setBusy("save"); setNotice(null);
    const r = await saveCanvasAction(initial.id, { expectedRevision: base.current.revision, title: canvas.title, pages: canvas.pages, profile: canvas.profile, mode: canvas.mode, language: canvas.language, themeId: canvas.themeId, ...(canvas.options ? { options: canvas.options } : {}), ...(canvas.params ? { params: canvas.params } : {}), ...(canvas.interactions ? { interactions: canvas.interactions } : {}) });
    if (!r.ok) { setBusy(null); setNotice({ tone: "error", text: r.error.message }); return; }
    const saved = r.value.canvas.canvas;
    base.current = { revision: saved.revision, json: snapshot(canvas) };
    savedBlocks.current = new Map(canvas.pages.flatMap((p) => p.blocks).map((b) => [b.id, JSON.stringify(b.props) + JSON.stringify(b.bindings)]));
    ed.adoptRevision(saved.revision);
    setReviewNow("DRAFT");
    setServerProblems(r.value.problems);
    const fresh = await resolveCanvasAction(initial.id, { ...(filters.periodId ? { periodId: filters.periodId } : {}), places: filters.places, group: filters.group, status: filters.status, level: filters.level, indicator: filters.indicator, donors: filters.donors ?? [], partners: filters.partners ?? [], datasets: filters.datasets ?? [] });
    if (fresh.ok) setResolved(fresh.value);
    setBusy(null);
    setNotice({ tone: "ok", text: r.value.problems.length ? `Saved. ${r.value.problems.length} block${r.value.problems.length === 1 ? " is" : "s are"} not set up yet.` : "Saved." });
  }

  saveRef.current = () => { if (dirty && busy === null) void save(); };
  // Slicer choices on dataset columns (Phase 54): part of the viewer's filter, so the page is read again with them; never saved.
  const datasetApi = useMemo<DatasetFilterApi>(() => ({
    values: (source, column) => datasetFilterValues(filters, source, column),
    toggle: (source, column, value, multi) => setFilters((f) => toggleDatasetFilter(f, source, column, value, multi)),
    clear: (source, column) => setFilters((f) => ({ ...f, datasets: (f.datasets ?? []).filter((d) => !(d.source === source && d.column === column)) })),
  }), [filters]);

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
  const containersOnPage = blocks.filter((b) => isContainerKind(b.kind) && b.id !== ed.selected).map((b) => ({ id: b.id, label: `${label(b.kind)}${(b.props as { title?: string })?.title ? `: ${(b.props as { title?: string }).title}` : ""}`, tabs: Array.isArray((b.props as { titles?: unknown })?.titles) ? ((b.props as { titles: string[] }).titles) : null }));
  const selectedProblems = [...problems, ...serverProblems.filter((s) => !problems.some((p) => p.blockId === s.blockId && p.message === s.message))];

  return (
    <DatasetFilterProvider api={datasetApi}><DatasetMapProvider value={DatasetMapView}>
    <div ref={stage} style={editing ? { paddingInlineEnd: pinnedWidth(drawers) } : undefined} className="space-y-4 [&:fullscreen]:overflow-auto [&:fullscreen]:bg-white [&:fullscreen]:p-6 dark:[&:fullscreen]:bg-slate-950" data-testid="canvas-workspace" data-editing={editing || undefined} data-presenting={present.presenting || undefined}>
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          {editing ? <input aria-label="Name" className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xl font-semibold dark:border-slate-600 dark:bg-slate-900" value={canvas.title} onChange={(e) => ed.rename(e.target.value)} /> : <h1 className="truncate page-title">{canvas.title}</h1>}
          <p className="text-xs text-slate-500">{SCOPE_LABEL[initial.scope]} · {canvas.mode === "LIVE" ? "Live: figures are read when you open it" : "Published: a design to share"}{initial.sourceKind ? ` · from an older ${initial.sourceKind.toLowerCase()}` : ""}{dirty ? ` · ${t("canvas.ui.unsaved")}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <PresenceChips peers={peers} />
          {!editing && live && (live.choices.periods.length > 0 || live.choices.places.length > 0 || live.choices.groups.length > 0 || live.choices.statuses.length > 0 || live.choices.levels.length > 0) && <button type="button" className={BTN} aria-pressed={paneOpen || hasFilterBar} aria-controls="canvas-filter-pane" onClick={() => setPaneOpen((v) => !v)}>{t("canvas.ui.filtersOpen")}</button>}
          {!editing && present.available && <button type="button" className={BTN} onClick={present.start}>{t("canvas.ui.present")}</button>}
          {canEdit && <button type="button" className={BTN} aria-pressed={editing} onClick={() => setEditing((v) => !v)}>{editing ? t("canvas.ui.doneEditing") : t("canvas.ui.edit")}</button>}
          {editing && <><button type="button" className={BTN} aria-pressed={drawers.addOpen} aria-controls="add-drawer-shell" aria-keyshortcuts="Control+Shift+A Meta+Shift+A" onClick={() => setDrawers({ addOpen: !drawers.addOpen })}>{t("drawer.add")}</button><button type="button" className={BTN} aria-pressed={drawers.editOpen} aria-controls="edit-drawer-shell" aria-keyshortcuts="Control+Shift+E Meta+Shift+E" onClick={() => setDrawers({ editOpen: !drawers.editOpen })}>{t("drawer.edit")}</button><button type="button" className={BTN} onClick={() => session.setPaletteOpen(true)} aria-keyshortcuts="Control+K Meta+K">{t("editor.palette.title")}</button><button type="button" className={BTN} onClick={() => session.setShortcutsOpen(true)} aria-label={t("editor.shortcuts.title")}>?</button><button type="button" className={BTN} onClick={ed.undo} disabled={!ed.canUndo}>{t("canvas.ui.undo")}</button><button type="button" className={BTN} onClick={ed.redo} disabled={!ed.canRedo}>{t("canvas.ui.redo")}</button></>}
          {canEdit && <button type="button" className={`${BTN} bg-brand-700 text-white hover:bg-brand-800 dark:hover:bg-brand-800`} onClick={() => void save()} disabled={!dirty || busy !== null}>{busy === "save" ? t("canvas.ui.saving") : t("canvas.ui.save")}</button>}
          <details className="relative" ref={menu}>
            <summary className={`${BTN} cursor-pointer list-none`}>{t("canvas.ui.more")}</summary>
            <ul className="absolute end-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => void downloadPicture(document.querySelector<HTMLElement>('[data-testid="canvas-grid"]'), canvas.title).then((r) => setNotice(r.ok ? { tone: "ok", text: "Picture saved to your downloads." } : { tone: "error", text: r.message })))}>{t("canvas.ui.downloadPicture")}</button></li>
              <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => window.print())}>{t("canvas.ui.print")}</button></li>
              {FILE_FORMATS.map(([format, name]) => <li key={format}><a className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" data-export={format} href={dirty ? undefined : `/api/canvases/${encodeURIComponent(initial.id)}/export?format=${format}`} aria-disabled={dirty || undefined} onClick={dirty ? (e) => { e.preventDefault(); menu.current?.removeAttribute("open"); setNotice({ tone: "error", text: "Save your changes first: a file is made from the saved canvas." }); } : () => menu.current?.removeAttribute("open")}>{t(`canvas.ui.${name}` as never)}</a></li>)}
              <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => download(`${canvas.title}.canvas.json`, "application/json", canvasJson(canvas)))}>{t("canvas.ui.downloadFile")}</button></li>
              {dataTables.length > 0 && <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => void downloadWorkbook())}>{t("canvas.ui.dataXlsx")}</button></li>}
              {dataTables.length > 0 && <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => download(`${canvas.title}-data.csv`, "text/csv", tablesCsv(dataTables)))}>{t("canvas.ui.dataCsv")}</button></li>}
              {subscribed !== "WEEKLY" && <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => void subscribe("WEEKLY"))}>{t("canvas.ui.subWeekly")}</button></li>}
              {subscribed !== "MONTHLY" && <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => void subscribe("MONTHLY"))}>{t("canvas.ui.subMonthly")}</button></li>}
              {subscribed !== "NONE" && <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => void subscribe("NONE"))}>{t("canvas.ui.subStop")}</button></li>}
              <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => download(`${canvas.title}-descriptions.txt`, "text/plain", altPack(canvas)))}>{t("canvas.ui.downloadAlt")}</button></li>
              <li><button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => void copy())} disabled={busy !== null}>{t("canvas.ui.makeCopy")}</button></li>
              {canEdit && <li><button type="button" className="block w-full px-3 py-1.5 text-start text-red-700 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={choose(() => void remove())} disabled={busy !== null}>{t("canvas.ui.delete")}</button></li>}
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
          <ThemePicker value={canvas.themeId} onChange={(id) => ed.setTheme(id)} />
          <ThemeFileControl canvas={canvas} onLoad={ed.loadTheme} />
          <PageLayoutPanel canvas={canvas} page={ed.page} snap={session.view.snap !== false} onSnap={session.setSnap} onPreset={(id) => ed.pagePreset(ed.page.id, id)} onResetTheme={ed.resetTheme} label={(id) => { const b = canvas.pages.flatMap((p) => p.blocks).find((x) => x.id === id); return b ? label(b.kind) : id; }} />
          <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">Language</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={canvas.language} onChange={(e) => ed.setMeta({ language: e.target.value })}>{[["en", "English"], ["fr", "Français"], ["es", "Español"], ["ar", "العربية"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">Kind</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={canvas.mode} onChange={(e) => ed.setMeta({ mode: e.target.value as Canvas["mode"] })}><option value="LIVE">Live dashboard</option><option value="PUBLISHED_ONLY">Infographic to share</option></select></label>
        </section>
      )}

      <nav aria-label="Pages" className="flex flex-wrap items-center gap-1 print:hidden">
        {canvas.pages.map((p) => <button key={p.id} type="button" aria-current={p.id === ed.page.id ? "page" : undefined} onClick={() => { ed.setPageId(p.id); ed.setSelected(null); }} className={`rounded-t border-b-2 px-3 py-1.5 text-sm ${p.id === ed.page.id ? "border-brand-600 font-semibold" : "border-transparent text-slate-600 hover:border-slate-300"}`}>{p.title || "Page"}</button>)}
        {editing && <button type="button" className="px-2 py-1 text-sm text-brand-700 underline" onClick={ed.addPage}>{t("canvas.ui.addPage")}</button>}
        {editing && <label className="ms-3 flex items-center gap-1 text-xs">Rename<input aria-label="Page name" className="rounded border border-slate-300 bg-white px-1 py-0.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={ed.page.title} onChange={(e) => ed.renamePage(ed.page.id, e.target.value)} /></label>}
        {editing && canvas.pages.length > 1 && <button type="button" className="ms-2 text-xs text-red-700 underline" onClick={() => ed.removePage(ed.page.id)}>{t("canvas.ui.removePage")}</button>}
      </nav>

      {live && !hasFilterBar && (isFiltered(filters) || paneOpen) && (live.choices.periods.length > 0 || live.choices.places.length > 0 || live.choices.groups.length > 0 || live.choices.statuses.length > 0 || live.choices.levels.length > 0) && (
        <section id="canvas-filter-pane" aria-label="Filters" className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3 text-sm print:hidden dark:bg-slate-900" data-testid="canvas-filters">
          {live.choices.periods.length > 0 && <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">{t("canvas.ui.filtersPeriod")}</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={filters.periodId} onChange={(e) => setFilters((f) => ({ ...f, periodId: e.target.value }))}><option value="">{t("canvas.ui.filtersLatest")}</option>{live.choices.periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
          {live.choices.places.length > 0 && <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">{t("canvas.ui.filtersPlace")}</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={filters.places[0] ?? ""} onChange={(e) => setFilters((f) => ({ ...f, places: e.target.value ? [e.target.value] : [] }))}><option value="">{t("canvas.ui.filtersAllPlaces")}</option>{live.choices.places.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>}
          {live.choices.groups.length > 0 && <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">{t("canvas.ui.filtersGroup")}</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={filters.group} onChange={(e) => setFilters((f) => ({ ...f, group: e.target.value }))}><option value="">{t("canvas.ui.filtersEveryone")}</option>{live.choices.groups.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>}
          {live.choices.levels.length > 0 && <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">{t("canvas.ui.filtersLevel")}</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={filters.level} onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value, indicator: "" }))}><option value="">{t("canvas.ui.filtersAllLevels")}</option>{live.choices.levels.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>}
          {live.choices.indicators.length > 0 && <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">{t("canvas.ui.filtersIndicator")}</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={filters.indicator} onChange={(e) => setFilters((f) => ({ ...f, indicator: e.target.value }))}><option value="">{t("canvas.ui.filtersAllIndicators")}</option>{live.choices.indicators.map((i) => <option key={i.id} value={i.id}>{i.label} {i.name}</option>)}</select></label>}
          {live.choices.statuses.length > 0 && <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">{t("canvas.ui.filtersStatus")}</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}><option value="">{t("canvas.ui.filtersAny")}</option>{live.choices.statuses.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>}
          {isFiltered(filters) && <button type="button" className={BTN} onClick={() => setFilters((f) => drillUp(f))}>{t("canvas.ui.filtersDrillUp")}</button>}
          {isFiltered(filters) && <button type="button" className={BTN} onClick={() => setFilters(NO_FILTER)}>{t("canvas.ui.filtersClear")}</button>}
          <p className="text-xs text-slate-500">{t("canvas.ui.filtersNote")}{filters.group ? " A group shows what was recorded for it; no running total is invented." : ""}</p>
        </section>
      )}

      <div>
        <div onDragOver={editing ? (e) => { if (e.dataTransfer.types.includes(BLOCK_DRAG_TYPE) || e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } } : undefined}
          onDrop={editing ? (e) => { const dropped = e.dataTransfer.files?.[0]; if (dropped && isPicture(dropped)) { e.preventDefault(); const g = document.querySelector<HTMLElement>('[data-testid="canvas-grid"]'); const rect = g?.getBoundingClientRect(); const sc = Number(g?.dataset.scale ?? 0); const at = g?.dataset.mode === "FREE" && rect && sc > 0 ? { x: Math.round((e.clientX - rect.left) / sc), y: Math.round((e.clientY - rect.top) / sc) } : undefined; void uploadPicture(dropped).then((r) => { if (r.ok) ed.addImage(r.asset, at); else setNotice({ tone: "error", text: r.message }); }); return; } const kind = e.dataTransfer.getData(BLOCK_DRAG_TYPE); const grid = document.querySelector<HTMLElement>('[data-testid="canvas-grid"]'); if (!kind) return; e.preventDefault(); const r = grid?.getBoundingClientRect(); const freeScale = Number(grid?.dataset.scale ?? 0); if (grid?.dataset.mode === "FREE" && r && freeScale > 0) { ed.addAtPx(kind, { x: Math.round((e.clientX - r.left) / freeScale), y: Math.round((e.clientY - r.top) / freeScale) }); setRecent((list) => [kind, ...list.filter((k) => k !== kind)].slice(0, 6)); return; } const cell = grid && r ? pointToCell({ x: e.clientX, y: e.clientY }, { left: r.left, top: r.top, width: r.width, offsetWidth: grid.offsetWidth }, parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) : { x: 0, y: 0 }; ed.addAt(kind, cell); setRecent((list) => [kind, ...list.filter((k) => k !== kind)].slice(0, 6)); } : undefined}>
          {blocks.length === 0 && ed.page.mode === "FREE" && <p className="mb-2 rounded-lg border border-dashed border-slate-300 p-3 text-center text-sm text-slate-500" data-testid="empty-free-hint">{editing ? "This page is empty. Tick indicators in the data list, or open Add and drag a block or a picture onto the page." : canEdit ? "This page is empty. Choose Edit to add blocks." : "This page is empty."}</p>}
          {blocks.length === 0 && ed.page.mode !== "FREE" ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{editing ? "This page is empty. Open Add to choose a block, or drag one onto the page." : canEdit ? "This page is empty. Choose Edit to add blocks." : "This page is empty."}</p>
          ) : (
            <BlockEditProvider value={editing ? (id, change) => { const b = ed.page.blocks.find((x) => x.id === id); if (b && b.style?.locked !== true) ed.setProps(id, change(b.props)); } : null}>
            <FilterSlotProvider value={live && hasFilterBar ? <FilterPane bar={filterBar} choices={live.choices} filters={filters} tone={{ strip: pageTheme.accentSoft, ink: pageTheme.accent, on: pageTheme.accent }} onChange={setFilters} onClear={() => setFilters(NO_FILTER)} /> : null}>
            <div style={{ zoom: session.view.zoom }} data-testid="zoom" data-zoom={session.view.zoom}><CanvasPageGrid canvas={canvas} blocks={blocks} drawings={drawings} widgets={widgets} models={live?.models} repeats={live?.repeats} editing={editing} page={ed.page} snap={session.view.snap !== false} onFrame={ed.frame} onClearSelection={() => ed.setSelection({ ids: [] })} selectedIds={new Set(ed.selection.ids)} onSelect={ed.selectBlock} showGrid={session.view.grid} onMarquee={(cells, add) => (cells.w === 0 ? ed.setSelection({ ids: [] }) : selectByRectangle({ canvas, page: ed.page, selection: ed.selection, select: ed.setSelection } as never, cells, add))}
              onPick={live ? (name) => setFilters((f) => pickToFilter(live.choices, f, name)) : undefined}
              isChanged={(b) => !previewCurrent && savedBlocks.current.get(b.id) !== JSON.stringify(b.props) + JSON.stringify(b.bindings)}
              frame={(b, node) => <BlockFrame bounds={b.bounds} movable={editing && b.style?.locked !== true} selected={ed.selection.ids.includes(b.id)} label={label(b.kind)} onBounds={(c) => ed.bounds(b.id, c)} onSelect={() => ed.selectBlock(b.id)}>{node}</BlockFrame>} /></div>
            </FilterSlotProvider>
            </BlockEditProvider>
          )}

          <section className="mt-4 space-y-2 print:hidden" aria-label="Design check">
            <details>
              <summary className="cursor-pointer text-sm font-medium">Design check: {findings.length === 0 && problems.length === 0 ? "nothing to fix" : `${findings.length + problems.length} thing${findings.length + problems.length === 1 ? "" : "s"} to look at`}{canvas.mode === "PUBLISHED_ONLY" ? (canPublish(findings) && problems.length === 0 ? " · ready to share" : " · not ready to share") : ""}</summary>
              <ul className="mt-2 space-y-1 text-sm">
                {problems.map((p, i) => <li key={`p${i}`}><span className="font-medium text-amber-800">Not set up</span> · {p.blockId ? `${label(canvas.pages.flatMap((pg) => pg.blocks).find((b) => b.id === p.blockId)?.kind ?? "")}: ` : ""}{p.message}</li>)}
                {findings.map((f, i) => <li key={`f${i}`}><span className={`font-medium ${f.severity === "BLOCKER" ? "text-red-700" : "text-amber-800"}`}>{SEVERITY[f.severity]}</span> · {f.message}</li>)}
              </ul>
              {leftOut.length > 0 && <p className="mt-2 text-xs text-slate-500">{t("canvas.ui.leftOutOfFile")}: {leftOut.map((x) => `${label(x.kind)} (${x.reason.replace(/\.$/, "").toLowerCase()})`).join("; ")}.</p>}
            </details>
          </section>

          {canEdit || initial.mine ? (
            <section className="mt-2 space-y-2 print:hidden" aria-label={t("canvas.ui.sharePublish")}>
              <details data-testid="share-publish"><summary className="cursor-pointer text-sm font-medium">{t("canvas.ui.sharePublish")} · {t(`canvas.ui.status.${reviewNow}` as never)}</summary>
                <div className="mt-3"><PublishPanel key={base.current.revision} canvasId={initial.id} canEdit={canEdit} dirty={dirty} reviewStatus={reviewNow} onStatus={setReviewNow} reviewNote={initial.reviewNote} snapshotEvery={initial.snapshotEvery} /></div>
              </details>
              <details data-testid="history"><summary className="cursor-pointer text-sm font-medium">{t("canvas.ui.history")}</summary>
                <div className="mt-3"><VersionsPanel canvasId={initial.id} revision={base.current.revision} canEdit={canEdit} onRestore={(title, from) => { ed.restore(title, from); setEditing(true); setNotice({ tone: "ok", text: "That version is on the page. Check it, then Save, or Undo to go back." }); }} /></div>
              </details>
            </section>
          ) : null}
        </div>

      </div>
      {editing && (
        <EditorDrawers editor={{ canvas, page: ed.page, selectionIds: ed.selection.ids, addImage: (a) => ed.addImage(a), add: (k, props) => { ed.add(k, props); setRecent((list) => [k, ...list.filter((x) => x !== k)].slice(0, 6)); }, addStarter: ed.addStarter, setFormat: ed.setFormat, setInteraction: ed.setInteraction }}
          prefs={drawers} onPrefs={setDrawers} models={live?.models} drawings={(live?.drawings ?? []) as never} projects={projects} indicatorsByProject={indicatorsByProject} fallbackProjectId={initial.projectId} recent={recent} label={(b) => label(b.kind)}
          build={ed.selectedBlock ? <>{ed.page.mode === "FREE" && <FrameFields block={ed.selectedBlock} page={ed.page} onFrame={(patch) => ed.frame(ed.selectedBlock!.id, patch)} />}<Inspector block={ed.selectedBlock} label={label(ed.selectedBlock.kind)} projects={projects} indicatorsByProject={indicatorsByProject} fallbackProjectId={initial.projectId} problems={selectedProblems} language={canvas.language} containers={containersOnPage} onContainer={(c) => ed.container(ed.selectedBlock!.id, c)}
            onProps={(p) => ed.setProps(ed.selectedBlock!.id, p)} onProject={(pid) => ed.setProject(ed.selectedBlock!.id, pid)} onBounds={(c) => ed.bounds(ed.selectedBlock!.id, c)} onAlt={(a, d) => ed.alt(ed.selectedBlock!.id, a, d)} onMotion={(m) => ed.motion(ed.selectedBlock!.id, m)} onAction={(a) => ed.act(ed.selectedBlock!.id, a)} /></> : null}
          multiActions={<div className="flex flex-wrap gap-1" data-testid="multi-selection">{["alignLeft", "alignCenter", "alignRight", "alignTop", "alignMiddle", "alignBottom", "distributeH", "distributeV", "matchWidth", "matchHeight", "group", "duplicate", "delete"].map((id) => <button key={id} type="button" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800" data-command={id} onClick={() => session.run(id)}>{t(`editor.cmd.${id}` as never)}</button>)}</div>}
          pageSettings={<LayersPanel page={ed.page} selection={ed.selection} onSelect={ed.selectBlock} onToggle={(id, flag) => { const block = ed.page.blocks.find((b) => b.id === id); if (block) ed.apply(setFlag(canvas, [id], flag, !(block.style?.[flag] === true))); }} />} />
      )}
      {convertId && ed.page.blocks.find((b) => b.id === convertId) && <ConvertDialog block={ed.page.blocks.find((b) => b.id === convertId)!} onConvert={(kind, accept) => void ed.apply(convertBlock(canvas, convertId, kind, accept))} onClose={() => setConvertId(null)} />}
      {session.paletteOpen && <CommandPalette state={session.state} onRun={session.run} onClose={() => session.setPaletteOpen(false)} />}
      {editing && <EditorTour />}
      {session.shortcutsOpen && <ShortcutSheet onClose={() => session.setShortcutsOpen(false)} />}
    </div>
    </DatasetMapProvider></DatasetFilterProvider>
  );
}

