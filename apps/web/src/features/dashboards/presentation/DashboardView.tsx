"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addWidget, resizeWidget, settleLayout, updateWidgetSettings, widgetProblems, type DashboardWidget, type MapWidgetQuery, type MetricQuery, type ProjectListQuery, type WidgetChange } from "@donordesk/domain/contexts/dashboards/index.js";
import {
  createDashboardLinkAction, deleteDashboardAction, getDashboardChartsAction, listDashboardLinksAction, revokeDashboardLinkAction, saveDashboardAction,
} from "@/lib/actions/dashboards";
import { useActionState } from "@/lib/client/action-state";
import type { ChartDrawing, DashboardLinkView, DashboardView as DashboardData } from "@/lib/server/schemas-dashboards";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PinToHomeButton } from "@/features/home-pins/presentation/PinToHomeButton";
import { DashboardCanvas } from "./DashboardCanvas";
import { nextPeriodFilter } from "../domain/cross-filter";
import { useTvMode } from "./use-tv-mode";
import { AddTilePanel } from "./AddTilePanel";
import { AddMapPanel } from "./AddMapPanel";
import { AddProjectListPanel } from "./AddProjectListPanel";
import { EditWidgetPanel } from "./EditWidgetPanel";
import { DashboardTabBar, TabAssigner, useDashboardTabs } from "./DashboardTabs";

const SCOPE_LABEL = { ORG: "Whole organisation", PROJECT: "One project", MINE: "Only me" } as const;

/** A dashboard: read it, change it (move, resize, remove, rename), share it, delete it. Changes are kept only when saved. */
export function DashboardView({ dashboard, charts: initialCharts, periods, projectNames }: { dashboard: DashboardData; charts: ChartDrawing[]; periods: ReadonlyArray<{ projectId: string; id: string; label: string }>; projectNames: Record<string, string> }) {
  const router = useRouter();
  const save = useActionState();
  const del = useActionState();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(dashboard.name);
  const [widgets, setWidgets] = useState<DashboardWidget[]>(dashboard.widgets as DashboardWidget[]);
  const [version, setVersion] = useState(dashboard.updatedAt);
  const [saved, setSaved] = useState(true);
  const [charts, setCharts] = useState(initialCharts);
  const [periodId, setPeriodId] = useState("");
  const [periodError, setPeriodError] = useState<string | null>(null);
  useEffect(() => setCharts(initialCharts), [initialCharts]);
  const byId = useMemo(() => new Map(charts.map((c) => [c.widgetId, c])), [charts]);
  const [projectFilter, setProjectFilter] = useState("");
  const tv = useTvMode(60, () => router.refresh());
  const projectIds = useMemo(() => [...new Set(widgets.map((w) => (w as { projectId?: string }).projectId).filter((x): x is string => !!x))], [widgets]);
  const tabbed = useDashboardTabs(widgets);
  const shown = useMemo(() => (projectFilter && !editing ? settleLayout(tabbed.visible.filter((w) => (w as { projectId?: string }).projectId === projectFilter)) : tabbed.visible), [tabbed.visible, projectFilter, editing]);
  /** A change made on the tab on screen replaces those charts only; the others keep their place. */
  const applyShown = (next: DashboardWidget[]) => {
    const ids = new Set(shown.map((w) => w.id));
    const byNext = new Map(next.map((w) => [w.id, w]));
    setWidgets((all) => all.filter((w) => !ids.has(w.id) || byNext.has(w.id)).map((w) => byNext.get(w.id) ?? w));
    setSaved(false);
  };
  const titles = useMemo(() => new Map(charts.map((c) => [c.widgetId, c.chart?.title ?? c.table?.title ?? ""])), [charts]);
  const dirty = !saved || name !== dashboard.name;

  /** The viewer's own period for this visit: charts are redrawn on the server; the saved dashboard is untouched. */
  async function choosePeriod(next: string) {
    setPeriodId(next);
    setPeriodError(null);
    const r = await getDashboardChartsAction(dashboard.id, next || undefined);
    if (r.ok) setCharts(r.value); else setPeriodError(r.error.message);
  }
  const onPick = (name: string) => { const next = nextPeriodFilter(periodId, periods, name); if (next !== periodId) void choosePeriod(next); };
  const periodChoices = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of periods) if (!seen.has(p.id)) seen.set(p.id, projectIds.length > 1 ? `${projectNames[p.projectId] ?? "Project"}: ${p.label}` : p.label);
    return [...seen];
  }, [periods, projectIds.length, projectNames]);

  /** A number tile is added to the unsaved layout like any chart and kept when the dashboard is saved. */
  function addTile(projectId: string, metric: MetricQuery) {
    const next = addWidget(widgets, { id: `t${Math.random().toString(36).slice(2, 10)}`, projectId, kind: "METRIC", metric });
    if (!next) return;
    setWidgets(next);
    setSaved(false);
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const editingWidget = editingId ? widgets.find((w) => w.id === editingId) ?? null : null;
  /** A widget's settings change where it stands; the whole list is checked before the change is kept. */
  function changeWidget(change: WidgetChange) {
    if (!editingId) return;
    const next = updateWidgetSettings(widgets, editingId, change);
    const problem = next ? widgetProblems(next)[0] : { message: "That change does not fit this widget." };
    if (!next || problem) { setChangeError(problem?.message ?? "That change could not be made."); return; }
    setChangeError(null);
    setWidgets(next);
    setSaved(false);
    setEditingId(null);
  }

  /** A project list is a wide table: it is added full width. */
  function addProjectList(projectId: string, projectList: ProjectListQuery) {
    const id = `l${Math.random().toString(36).slice(2, 10)}`;
    const next = addWidget(widgets, { id, projectId, kind: "PROJECT_LIST", projectList });
    if (!next) return;
    setWidgets(resizeWidget(next, id, 12, 5));
    setSaved(false);
  }

  /** A map is added full width: it needs room to be read. */
  function addMap(projectId: string, map: MapWidgetQuery) {
    const id = `m${Math.random().toString(36).slice(2, 10)}`;
    const next = addWidget(widgets, { id, projectId, kind: "MAP", map });
    if (!next) return;
    setWidgets(resizeWidget(next, id, 12, 8));
    setSaved(false);
  }

  async function commit() {
    const r = await save.run(() => saveDashboardAction({ name, scope: dashboard.scope, ...(dashboard.projectId ? { projectId: dashboard.projectId } : {}), widgets, expectedUpdatedAt: version }, dashboard.id));
    if (r && typeof r === "object") { setVersion(r.updatedAt); setSaved(true); setEditing(false); router.refresh(); }
  }
  async function remove() {
    if (!window.confirm(`Delete "${dashboard.name}"? Its share links stop working.`)) return;
    if (await del.run(() => deleteDashboardAction(dashboard.id))) router.push(dashboard.projectId ? `/dashboards?project=${dashboard.projectId}` : "/dashboards");
  }

  return (
    <div ref={tv.ref} className={`space-y-4 ${tv.active ? "overflow-auto bg-white p-6 dark:bg-slate-950" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {editing ? <Input aria-label="Dashboard name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /> : <h1 className="truncate text-xl font-semibold tracking-tight">{dashboard.name}</h1>}
          <p className="mt-1 text-xs text-slate-500">{SCOPE_LABEL[dashboard.scope]}{dashboard.projectId && projectNames[dashboard.projectId] ? ` · ${projectNames[dashboard.projectId]}` : ""} · {widgets.length} chart{widgets.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-no-print>
          {!editing && projectIds.length > 1 && (
            <select aria-label="Show one project" className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-white/15 dark:bg-white/5" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="">All projects</option>
              {projectIds.map((id) => <option key={id} value={id}>{projectNames[id] ?? "A project"}</option>)}
            </select>
          )}
          {!editing && periodChoices.length > 0 && (
            <select aria-label="Show one period" className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-white/15 dark:bg-white/5" value={periodId} onChange={(e) => void choosePeriod(e.target.value)}>
              <option value="">All periods (as saved)</option>
              {periodChoices.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          )}
          {!editing && <PinToHomeButton dashboardId={dashboard.id} orgWide={dashboard.scope === "ORG"} />}
          {!editing && <Button variant="secondary" onClick={tv.toggle}>{tv.active ? "Leave full screen" : "Full screen"}</Button>}
          {!editing && <Button variant="secondary" onClick={() => window.print()}>Print</Button>}
        </div>
        {dashboard.canEdit && (
          <div className="flex flex-wrap gap-2" data-no-print>
            {editing ? (
              <>
                <Button onClick={() => void commit()} pending={save.busy} disabled={save.busy || !dirty || !name.trim()}>Save</Button>
                <Button variant="secondary" onClick={() => { setWidgets(dashboard.widgets as DashboardWidget[]); setName(dashboard.name); setSaved(true); setEditing(false); }}>Cancel</Button>
              </>
            ) : <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
          </div>
        )}
      </header>
      {periodError && <p role="alert" className="text-sm text-danger-600">{periodError}</p>}
      {save.error && <p role="alert" className="text-sm text-danger-600">{save.error}</p>}
      {editing && <p className="text-xs text-slate-500">Drag a chart by its title bar, resize it from the corner, or focus the title bar and use the arrow keys (Shift with an arrow key resizes). Nothing is kept until you save.</p>}

      {editing && editingWidget && <EditWidgetPanel key={editingWidget.id} widget={editingWidget} chartTitle={(editingWidget.spec as { title?: string } | undefined)?.title ?? titles.get(editingWidget.id) ?? ""} onApply={changeWidget} onCancel={() => { setEditingId(null); setChangeError(null); }} />}
      {changeError && <p role="alert" className="text-sm text-danger-600">{changeError}</p>}
      {editing && <AddTilePanel projects={dashboard.scope === "PROJECT" && dashboard.projectId ? { [dashboard.projectId]: projectNames[dashboard.projectId] ?? "This project" } : projectNames} onAdd={addTile} full={widgets.length >= 24} />}
      {editing && <AddProjectListPanel projects={dashboard.scope === "PROJECT" && dashboard.projectId ? { [dashboard.projectId]: projectNames[dashboard.projectId] ?? "This project" } : projectNames} onAdd={addProjectList} full={widgets.length >= 24} />}
      {editing && <AddMapPanel projects={dashboard.scope === "PROJECT" && dashboard.projectId ? { [dashboard.projectId]: projectNames[dashboard.projectId] ?? "This project" } : projectNames} onAdd={addMap} full={widgets.length >= 24} />}
      <DashboardTabBar tabs={tabbed.tabs} active={tabbed.active} onSelect={tabbed.setActive} overviewLabel="Overview" />
      {editing && widgets.length > 0 && <TabAssigner widgets={widgets} titles={titles} onChange={(next) => { setWidgets(next); setSaved(false); }} />}
      {widgets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">No charts yet. Open a project&apos;s Data Center, build a chart and choose &ldquo;Add to a dashboard&rdquo;.</p>
      ) : (
        <>
        {periodId && !editing && (
          <p role="status" className="flex flex-wrap items-center gap-2 text-sm" data-no-print>
            Showing {periodChoices.find(([id]) => id === periodId)?.[1] ?? "one period"}. Click a period on a chart to switch, or
            <button type="button" className="underline" onClick={() => void choosePeriod("")}>show all periods</button>
          </p>
        )}
        <DashboardCanvas widgets={shown} charts={byId} editing={editing} labels={projectNames} onChange={applyShown} onPick={onPick} onEdit={setEditingId} />
        </>
      )}

      {dashboard.canEdit && !editing && !tv.active && (
        <>
          <SharePanel dashboardId={dashboard.id} />
          <section className="border-t border-slate-200 pt-4 dark:border-slate-700">
            <Button variant="secondary" onClick={() => void remove()} pending={del.busy}>Delete this dashboard</Button>
            {del.error && <p role="alert" className="mt-2 text-sm text-danger-600">{del.error}</p>}
          </section>
        </>
      )}
    </div>
  );
}

function SharePanel({ dashboardId }: { dashboardId: string }) {
  const [links, setLinks] = useState<DashboardLinkView[] | null>(null);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("30");
  const [fresh, setFresh] = useState<{ view: string; embed: string } | null>(null);
  const act = useActionState();
  const load = useCallback(async () => { const r = await listDashboardLinksAction(dashboardId); setLinks(r.ok ? r.value : []); }, [dashboardId]);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    const r = await act.run(() => createDashboardLinkAction(dashboardId, { label, expiresInDays: Number(days) }));
    if (r && typeof r === "object") {
      setFresh({ view: `${window.location.origin}/shared/dashboard/${r.token}`, embed: `${window.location.origin}/embed/dashboard/${r.token}` });
      setLabel("");
      await load();
    }
  }
  async function revoke(id: string) { if (await act.run(() => revokeDashboardLinkAction(id))) await load(); }

  return (
    <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
      <h2 className="text-base font-semibold">Share a read-only link</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">Anyone with the link sees these charts as they stand whenever they open it, with no sign-in. Finance figures are never shown through a link. A link expires and can be withdrawn.</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Who is it for?"><Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} /></Field>
        <Field label="Works for (days)"><Input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        <Button onClick={() => void create()} pending={act.busy} disabled={!label.trim()}>Make a link</Button>
      </div>
      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
      {fresh && (
        <div role="status" className="space-y-2 rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-500/10">
          <p>Copy these now; they are not shown again.</p>
          <label className="block text-xs">The link<input readOnly className="mt-1 w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs dark:bg-slate-900" value={fresh.view} onFocus={(e) => e.currentTarget.select()} /></label>
          <label className="block text-xs">To put it in another page<input readOnly className="mt-1 w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs dark:bg-slate-900" value={`<iframe src="${fresh.embed}" width="100%" height="640" style="border:0" title="Dashboard"></iframe>`} onFocus={(e) => e.currentTarget.select()} /></label>
        </div>
      )}
      <ul className="space-y-1 text-sm">
        {(links ?? []).map((l) => (
          <li key={l.id} className="flex items-center gap-3">
            <span>{l.label}</span>
            <span className="text-xs text-slate-500">{l.revoked ? "Withdrawn" : l.live ? `Works until ${l.expiresAt.slice(0, 10)}` : "Expired"}</span>
            {l.live && <Button variant="secondary" onClick={() => void revoke(l.id)}>Withdraw</Button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
