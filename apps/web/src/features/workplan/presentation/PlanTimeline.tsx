"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WORKPLAN_COPY, addDays, formatShortDate } from "@donordesk/domain/contexts/workplan/index.js";
import type { WorkPlanRow } from "@/lib/server/schemas";
import { dependencyLinks, elbowPath, waitingLine } from "../domain/dependency-view";
import { cascadePreview } from "../domain/cascade-preview";
import { reschedulePlannedActivityAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { applyDrag, confirmQuestion, isDraggable, keyboardDrag, pixelsToDays, type DragMode } from "../domain/timeline-drag";
import { chartWidthPx, fullRange, layoutTimeline, TIMELINE_ZOOMS, TIMELINE_ZOOM_LABEL, type DateRange, type TimelineBar, type TimelineDeadline, type TimelineLane, type TimelineZoom } from "../domain/timeline-layout";
import { LANE_ROW_PX, NO_FILTER, filterRows, flattenLayout, groupKey, isFiltering, linesHeight, type TimelineFilter } from "../domain/timeline-rows";

const ZOOM_KEY = "donordesk.timeline-zoom";
const HANDLE_PX = 8;
/** The name column's width: it stays in view while the chart scrolls sideways. */
const LABEL_PX = 280;
/** A bar at least this wide has room for its dates inside it. */
const BAR_TEXT_PX = 96;
const MIN_BAR_PX = 6;
const MILESTONE_PX = 18;
const HEADER = { months: 24, ticks: 20, deadlines: 24 } as const;
const NO_NAMES: Record<string, string> = {};
const HEADER_PX = HEADER.months + HEADER.ticks + HEADER.deadlines;
const DOT_CLASS = { ON_TIME: "bg-emerald-500", LATE: "bg-red-500", DONE: "bg-slate-400", CANCELLED: "bg-slate-300" } as const;
/** One token table: a signal's colour. The signal is also written in the bar's label, never colour alone. */
const SIGNAL_CLASS = {
  ON_TIME: "bg-emerald-500/80 text-white",
  LATE: "bg-red-500/85 text-white",
  DONE: "bg-slate-400/80 text-white",
  CANCELLED: "bg-slate-300/70 text-slate-600 line-through",
} as const;

interface Pending { id: string; start: string; end: string }
interface Gesture { id: string; mode: DragMode; startX: number; start: string; end: string; moved: boolean }

/**
 * Timeline: one bar per planned activity, grouped by output, with the report deadlines on top. A bar can be dragged (move),
 * or its ends dragged (change dates); nothing is saved until Save in the confirm bar. The keyboard does the same:
 * ←/→ move a day, Shift+←/→ change the end, Enter opens the confirm bar.
 */
export function PlanTimeline({ projectId, rows, deadlines, project, today, outputTitles, movableIds, names = NO_NAMES, userId }: {
  projectId: string;
  rows: WorkPlanRow[];
  deadlines: TimelineDeadline[];
  project: DateRange;
  today: string;
  outputTitles: Record<string, string>;
  /** Ids of the activities this person may move (decided on the server). */
  movableIds: string[];
  /** User id -> name, for the lead shown under each activity's name. */
  names?: Record<string, string>;
  /** The signed-in person, for the "Mine" filter. */
  userId?: string;
}) {
  const router = useRouter();
  const state = useActionState();
  const track = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<TimelineZoom>("MONTH");
  const [pending, setPending] = useState<Pending | null>(null);
  const [scope, setScope] = useState<"THIS" | "SERIES_FROM_HERE">("THIS");
  const [reason, setReason] = useState("");

  useEffect(() => {
    try { const saved = window.localStorage.getItem(ZOOM_KEY); if (saved && (TIMELINE_ZOOMS as readonly string[]).includes(saved)) { placed.current = false; setZoom(saved as TimelineZoom); } } catch { /* storage blocked: keep the default */ }
  }, []);
  // Changing the scale keeps the middle of what you were looking at in the middle (as a share of the whole plan).
  const keepCentre = useRef<number | null>(null);
  const chooseZoom = (z: TimelineZoom) => {
    const el = scroller.current;
    if (el && chartPx > 0) keepCentre.current = (el.scrollLeft + (el.clientWidth - LABEL_PX) / 2) / chartPx;
    setZoom(z);
    try { window.localStorage.setItem(ZOOM_KEY, z); } catch { /* remembered next time only if storage works */ }
  };

  const [filter, setFilter] = useState<TimelineFilter>(NO_FILTER);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [viewportPx, setViewportPx] = useState(1100);
  const [viewing, setViewing] = useState("");

  // The chart always spans the whole plan (the project, every activity, every deadline) and scrolls sideways; the filter only
  // decides which activities are drawn, never the extent, so filtering never moves the dates under your eyes.
  const range = useMemo(() => fullRange({ project, rows, deadlines }), [project.start, project.end, rows, deadlines]);
  const visibleRows = useMemo(() => filterRows(rows, filter, names), [rows, filter, names]);
  const shown = useMemo(() => visibleRows.map((r) => (pending && pending.id === r.id ? { ...r, plannedStart: pending.start, plannedEnd: pending.end } : r)), [visibleRows, pending]);
  const layout = useMemo(
    () => layoutTimeline({ rows: shown.map((r) => ({ ...r, waitingLabel: waitingLine(r.waitingFor) })), deadlines, range, zoom, today, outputTitles: new Map(Object.entries(outputTitles)) }),
    [shown, deadlines, range, zoom, today, outputTitles],
  );
  const chartPx = chartWidthPx(zoom, layout.days, viewportPx - LABEL_PX - 2);
  const lines = useMemo(() => flattenLayout(layout, collapsed), [layout, collapsed]);
  const bodyPx = linesHeight(lines);
  const tops = useMemo(() => { let y = 0; return lines.map((l) => { const top = y; y += l.height; return top; }); }, [lines]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const pendingRow = pending ? byId.get(pending.id) : undefined;
  // What else moves (or stays put) if this move is saved: the activities that wait for the moved one, by the domain's own rule.
  const cascade = useMemo(() => (pending ? cascadePreview(rows, pending.id, pending.start, pending.end) : null), [pending, rows]);

  // Arrows between activities that come after one another: drawn from where the bars actually are, so they follow zoom,
  // resizing and a drag in progress. Decorative: the same information is in each bar's label ("Waiting for …").
  const bars = useRef(new Map<string, HTMLElement>());
  const [arrows, setArrows] = useState<Array<{ key: string; d: string; finished: boolean }>>([]);
  const links = useMemo(() => dependencyLinks(rows, new Set(lines.flatMap((l) => (l.kind === "LANE" ? l.lane.bars.map((b) => b.id) : [])))), [rows, lines]);
  useLayoutEffect(() => {
    const draw = () => {
      const box = track.current?.getBoundingClientRect();
      if (!box) return;
      const rel = (id: string) => {
        const r = bars.current.get(id)?.getBoundingClientRect();
        return r ? { x: r.left - box.left, y: r.top - box.top, width: r.width, height: r.height } : null;
      };
      const next = links.flatMap((l) => {
        const a = rel(l.fromId);
        const b = rel(l.toId);
        return a && b ? [{ key: `${l.fromId}>${l.toId}`, d: elbowPath(a, b), finished: l.finished }] : [];
      });
      // Keep the same array when nothing moved: a new (even empty) array every pass re-rendered without end.
      setArrows((prev) => (prev.length === next.length && prev.every((p, i) => p.key === next[i]!.key && p.d === next[i]!.d && p.finished === next[i]!.finished) ? prev : next));
    };
    draw();
    const el = track.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    return () => observer.disconnect();
  }, [links, layout, zoom, chartPx, bodyPx]);


  // ---- Scrolling: the name column stays, the header and every bar move together ----
  const updateViewing = useCallback(() => {
    const el = scroller.current;
    if (!el || chartPx <= 0) return;
    const visible = Math.max(0, el.clientWidth - LABEL_PX);
    const at = (px: number) => addDays(range.start, Math.min(layout.days - 1, Math.max(0, Math.floor((Math.max(0, Math.min(chartPx, px)) / chartPx) * layout.days))));
    setViewing(`${formatShortDate(at(el.scrollLeft), today)} to ${formatShortDate(at(el.scrollLeft + visible), today)}`);
  }, [chartPx, layout.days, range.start, today]);
  const scrollToChartX = useCallback((x: number, smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, x - (el.clientWidth - LABEL_PX) / 2), behavior: smooth ? "smooth" : "auto" });
  }, []);
  const scrollToDate = useCallback((date: string, smooth: boolean) => {
    const offset = (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${range.start}T00:00:00Z`).getTime()) / 86_400_000;
    scrollToChartX(((offset + 0.5) / layout.days) * chartPx, smooth);
  }, [range.start, layout.days, chartPx, scrollToChartX]);
  const panBy = (direction: -1 | 1) => { const el = scroller.current; if (el) el.scrollBy({ left: direction * Math.round((el.clientWidth - LABEL_PX) * 0.8), behavior: "smooth" }); };

  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setViewportPx(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // First paint: today in the middle when the plan covers it, else the start. After a zoom: the same middle as before.
  const placed = useRef(false);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (keepCentre.current !== null) {
      scrollToChartX(keepCentre.current * chartPx, false);
      keepCentre.current = null;
    } else if (!placed.current) {
      placed.current = true;
      if (layout.todayPct !== null) scrollToChartX((layout.todayPct / 100) * chartPx, false); else el.scrollLeft = 0;
    }
    updateViewing();
  }, [zoom, chartPx, layout.todayPct, scrollToChartX, updateViewing]);
  const scrollFrame = useRef(0);
  const onScroll = () => { cancelAnimationFrame(scrollFrame.current); scrollFrame.current = requestAnimationFrame(updateViewing); };

  // Drag the empty part of the chart to pan it (a bar keeps its own drag).
  const pan = useRef<{ x: number; left: number } | null>(null);
  function panDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    const el = scroller.current;
    if (!el) return;
    pan.current = { x: e.clientX, left: el.scrollLeft };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function panMove(e: React.PointerEvent<HTMLDivElement>) {
    if (pan.current && scroller.current) scroller.current.scrollLeft = pan.current.left - (e.clientX - pan.current.x);
  }
  function panUp(e: React.PointerEvent<HTMLDivElement>) {
    if (pan.current) { pan.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }
  }

  const toggleGroup = (key: string) => setCollapsed((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const allKeys = layout.groups.map(groupKey);

  function datesNow(id: string): { start: string; end: string } {
    if (pending?.id === id) return { start: pending.start, end: pending.end };
    const r = byId.get(id)!;
    return { start: r.plannedStart, end: r.plannedEnd };
  }
  function propose(id: string, next: { start: string; end: string }) {
    const r = byId.get(id)!;
    if (next.start === r.plannedStart && next.end === r.plannedEnd) { setPending(null); return; }
    if (pending?.id !== id) { setScope("THIS"); setReason(""); }
    setPending({ id, ...next });
  }

  function down(e: React.PointerEvent<HTMLButtonElement>, row: WorkPlanRow) {
    if (!isDraggable(row.status, movableIds.includes(row.id))) return;
    const box = e.currentTarget.getBoundingClientRect();
    const mode: DragMode = e.clientX - box.left <= HANDLE_PX ? "START" : box.right - e.clientX <= HANDLE_PX ? "END" : "MOVE";
    const d = datesNow(row.id);
    gesture.current = { id: row.id, mode, startX: e.clientX, start: d.start, end: d.end, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || !track.current) return;
    const days = pixelsToDays(e.clientX - g.startX, track.current.getBoundingClientRect().width, layout.days);
    if (days !== 0) g.moved = true;
    propose(g.id, applyDrag({ start: g.start, end: g.end }, g.mode, days));
  }
  function up(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    gesture.current = null;
    if (g) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function click(row: WorkPlanRow) {
    // A drag ends with a click; only a plain click opens the activity.
    if (pending?.id === row.id) return;
    router.push(`/projects/${projectId}/activities/plan/${row.id}`);
  }
  function key(e: React.KeyboardEvent<HTMLButtonElement>, row: WorkPlanRow) {
    if (e.key === "Escape") { setPending(null); return; }
    if (e.key === "Enter" && pending?.id === row.id) { e.preventDefault(); return; }
    const k = keyboardDrag(e.key, e.shiftKey);
    if (!k || !isDraggable(row.status, movableIds.includes(row.id))) return;
    e.preventDefault();
    propose(row.id, applyDrag(datesNow(row.id), k.mode, k.delta));
  }

  async function save() {
    if (!pending) return;
    const done = await state.run(() => reschedulePlannedActivityAction(pending.id, { plannedStart: pending.start, plannedEnd: pending.end, scope: pendingRow?.seriesId ? scope : "THIS", ...(reason.trim() ? { reason } : {}) }));
    if (done) { setPending(null); router.refresh(); }
  }

  const mineOn = filter.mineUserId !== undefined;
  const filtering = isFiltering(filter);
  const laneBars = (b: TimelineBar) => {
    const row = byId.get(b.id)!;
    const draggable = isDraggable(row.status, movableIds.includes(row.id));
    const isPending = pending?.id === b.id;
    const widthPx = b.milestone ? MILESTONE_PX : Math.max((b.widthPct / 100) * chartPx, MIN_BAR_PX);
    const leftPx = (b.leftPct / 100) * chartPx;
    return (
      <div key={b.id} className="contents">
        {b.original && <div className="absolute top-[7px] h-6 rounded border border-dashed border-slate-400/70" style={{ left: `${b.original.leftPct}%`, width: `${Math.max(b.original.widthPct, 0.3)}%` }} aria-hidden="true" />}
        <button
          type="button"
          ref={(el) => { if (el) bars.current.set(b.id, el); else bars.current.delete(b.id); }}
          aria-label={b.label + (draggable ? ". Use the arrow keys to change the dates." : "")}
          title={b.waiting ? `${b.label}. ${b.waiting}` : b.label}
          onPointerDown={(e) => down(e, row)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onClick={() => click(row)} onKeyDown={(e) => key(e, row)}
          className={`absolute top-[7px] flex h-6 items-center overflow-hidden text-left text-[11px] ${b.milestone ? "justify-center rounded-sm" : "rounded px-1.5"} ${SIGNAL_CLASS[b.signal]} ${draggable ? "cursor-grab touch-none" : ""} ${isPending ? "opacity-60 ring-2 ring-brand-500" : ""} ${b.clippedStart ? "rounded-l-none" : ""} ${b.clippedEnd ? "rounded-r-none" : ""}`}
          style={{ left: leftPx, width: widthPx }}
        >
          {b.progressPct !== undefined && <span className="pointer-events-none absolute inset-y-0 left-0 bg-black/20" style={{ width: `${b.progressPct}%` }} aria-hidden="true" />}
          {b.milestone ? <span className="relative" aria-hidden="true">◆</span> : widthPx >= BAR_TEXT_PX && <span className="relative truncate">{b.waiting ? "⧗ " : ""}{b.dates}</span>}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Zoom" className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-white/15">
          {TIMELINE_ZOOMS.map((z) => (
            <button key={z} type="button" aria-pressed={zoom === z} onClick={() => chooseZoom(z)}
              className={`min-h-[32px] px-3 text-xs font-medium ${zoom === z ? "bg-brand-600 text-white" : "bg-white text-slate-700 dark:bg-slate-900/40 dark:text-slate-200"}`}>
              {TIMELINE_ZOOM_LABEL[z]}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Move along the plan" className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-white/15">
          <button type="button" onClick={() => panBy(-1)} aria-label="Earlier" className="min-h-[32px] bg-white px-2.5 text-xs dark:bg-slate-900/40">◀</button>
          <button type="button" onClick={() => scrollToDate(today, true)} className="min-h-[32px] border-x border-slate-300 bg-white px-3 text-xs font-medium dark:border-white/15 dark:bg-slate-900/40">Today</button>
          <button type="button" onClick={() => panBy(1)} aria-label="Later" className="min-h-[32px] bg-white px-2.5 text-xs dark:bg-slate-900/40">▶</button>
        </div>
        {viewing && <span className="text-xs text-slate-500" aria-live="polite">Showing {viewing}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input type="search" value={filter.query} onChange={(e) => setFilter({ ...filter, query: e.target.value })} placeholder="Find an activity or person"
            aria-label="Find an activity or person" className="min-h-[32px] w-48 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-white/15 dark:bg-slate-900/40" />
          {userId && <FilterChip on={mineOn} onClick={() => setFilter({ ...filter, ...(mineOn ? { mineUserId: undefined } : { mineUserId: userId }) })}>Mine</FilterChip>}
          <FilterChip on={filter.lateOnly} onClick={() => setFilter({ ...filter, lateOnly: !filter.lateOnly })}>Late</FilterChip>
          <FilterChip on={filter.hideFinished} onClick={() => setFilter({ ...filter, hideFinished: !filter.hideFinished })}>Hide done</FilterChip>
          {filtering && <button type="button" className="text-xs text-brand-700 underline dark:text-brand-300" onClick={() => setFilter(NO_FILTER)}>Clear</button>}
          <button type="button" className="min-h-[32px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs dark:border-white/15 dark:bg-slate-900/40"
            onClick={() => setCollapsed(collapsed.size === allKeys.length ? new Set() : new Set(allKeys))}>
            {collapsed.size === allKeys.length && allKeys.length > 0 ? "Expand all" : "Collapse all"}
          </button>
        </div>
      </div>

      <div ref={scroller} onScroll={onScroll} className="relative max-h-[72vh] overflow-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900" tabIndex={0} aria-label="Timeline. Scroll sideways to move along the plan.">
        <div className="relative" style={{ width: LABEL_PX + chartPx }}>
          {/* Header: months, weeks and the report deadlines; it stays at the top while you scroll down */}
          <div className="sticky top-0 z-30 flex">
            <div className="sticky left-0 z-40 flex shrink-0 items-end border-b border-r border-slate-200 bg-white px-3 pb-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300" style={{ width: LABEL_PX, height: HEADER_PX }}>
              Activity
              <span className="ml-auto font-normal text-slate-500">{visibleRows.length}{filtering ? ` of ${rows.length}` : ""}</span>
            </div>
            <div className="relative shrink-0 border-b border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900" style={{ width: chartPx, height: HEADER_PX }} aria-hidden="true">
              {layout.months.map((m, i) => (
                <div key={i} className="absolute top-0 flex items-center border-l border-slate-200 px-1.5 text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200" style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%`, height: HEADER.months }}>
                  <span className="truncate">{m.label}</span>
                </div>
              ))}
              <div className="absolute inset-x-0" style={{ top: HEADER.months, height: HEADER.ticks }}>
                {layout.ticks.map((t, i) => <span key={i} className="absolute -translate-x-1/2 text-[10px] text-slate-500" style={{ left: `${t.leftPct}%` }}>{zoom === "WEEK" || zoom === "MONTH" ? t.label : ""}</span>)}
              </div>
              <div className="absolute inset-x-0" style={{ top: HEADER.months + HEADER.ticks, height: HEADER.deadlines }} role="list" aria-label="Report deadlines">
                {layout.deadlines.map((d, i) => (
                  <span key={i} role="listitem" title={d.label} aria-label={d.label}
                    className={`absolute top-1 -translate-x-1/2 text-xs ${d.kind === "DEADLINE" ? "text-red-600" : "text-amber-600"}`} style={{ left: `${d.leftPct}%` }}>
                    {d.kind === "DEADLINE" ? "▼" : "▽"}
                  </span>
                ))}
                {layout.todayPct !== null && <span className="absolute top-0 -translate-x-1/2 rounded bg-brand-600 px-1 text-[10px] font-medium leading-4 text-white" style={{ left: `${layout.todayPct}%` }}>Today</span>}
              </div>
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">{filtering ? "No activity matches. Clear the filter to see them all." : "Nothing is planned yet."}</p>
          ) : (
            <div className="flex">
              {/* Names: always in view on the left */}
              <div className="sticky left-0 z-20 shrink-0 border-r border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900" style={{ width: LABEL_PX, height: bodyPx }} role="list" aria-label="Activities">
                {lines.map((l) => l.kind === "GROUP" ? (
                  <div key={`g:${l.key}`} role="listitem" className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-2 dark:border-white/10 dark:bg-slate-800" style={{ height: l.height }}>
                    <button type="button" onClick={() => toggleGroup(l.key)} aria-expanded={!l.collapsed} aria-label={`${l.collapsed ? "Expand" : "Collapse"} ${l.title}`} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10">{l.collapsed ? "▶" : "▼"}</button>
                    <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100" title={l.title}>{l.title}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-slate-500">{l.count} · {l.donePct}% done{l.lateCount > 0 ? <span className="ml-1 font-medium text-red-600">{l.lateCount} late</span> : null}</span>
                  </div>
                ) : (
                  <LaneName key={`n:${l.key}`} projectId={projectId} lane={l.lane} names={names} today={today} />
                ))}
              </div>

              {/* The chart: as wide as the plan, so scrolling sideways moves every bar, the header and the grid together */}
              <div ref={track} className={`relative shrink-0 ${pan.current ? "cursor-grabbing" : "cursor-grab"}`} style={{ width: chartPx, height: bodyPx }}
                onPointerDown={panDown} onPointerMove={panMove} onPointerUp={panUp} onPointerCancel={panUp}>
                {layout.months.map((m, i) => <div key={i} className={`pointer-events-none absolute inset-y-0 border-l border-slate-200 dark:border-white/10 ${i % 2 === 1 ? "bg-slate-50/70 dark:bg-white/[0.03]" : ""}`} style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }} aria-hidden="true" />)}
                {arrows.length > 0 && (
                  <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full text-slate-500 dark:text-slate-400" aria-hidden="true">
                    <defs>
                      <marker id="plan-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                        <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                      </marker>
                    </defs>
                    {arrows.map((a) => <path key={a.key} d={a.d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={a.finished ? "4 3" : undefined} markerEnd="url(#plan-arrow)" />)}
                  </svg>
                )}
                {layout.todayPct !== null && <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-brand-500" style={{ left: `${layout.todayPct}%` }} aria-hidden="true" />}
                {lines.map((l, i) => l.kind === "GROUP" ? (
                  <div key={`g:${l.key}`} className="absolute inset-x-0 border-b border-slate-200 bg-slate-100/60 dark:border-white/10 dark:bg-slate-800/50" style={{ top: tops[i], height: l.height }} aria-hidden="true" />
                ) : (
                  <div key={`c:${l.key}`} className="absolute inset-x-0 border-b border-slate-100 dark:border-white/5" style={{ top: tops[i], height: l.height }}>
                    {l.lane.bars.map((b) => laneBars(b))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Legend />
      {filtering && <p className="text-xs text-slate-500">{rows.length - visibleRows.length} activities are hidden by the filter.</p>}

      {pending && pendingRow && (
        <div role="region" aria-label="Confirm the new dates" className="space-y-3 rounded-xl border border-brand-300 bg-brand-50 p-3 dark:border-brand-500/40 dark:bg-brand-500/10">
          <p className="text-sm font-medium">{pendingRow.title}: {confirmQuestion({ start: pending.start, end: pending.end }, today)}</p>
          {cascade && cascade.moves.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">These move too, because they wait for it:</p>
              <ul className="list-disc pl-5">
                {cascade.moves.map((m) => <li key={m.id}>{m.title}: {formatShortDate(m.from.start, today)} → {formatShortDate(m.to.start, today)}{m.to.end !== m.to.start ? ` to ${formatShortDate(m.to.end, today)}` : ""}</li>)}
              </ul>
            </div>
          )}
          {cascade && cascade.blocked.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Stays where it is: {cascade.blocked.map((b) => `${b.title} (${b.reason === "DONE" ? "done" : "cancelled"})`).join(", ")}. It will start before the activity it waits for ends.
            </p>
          )}
          {pendingRow.seriesId && (
            <div role="radiogroup" aria-label="Which activities" className="space-y-1 text-sm">
              <label className="flex items-center gap-2"><input type="radio" className="h-4 w-4" checked={scope === "THIS"} onChange={() => setScope("THIS")} />{WORKPLAN_COPY.onlyThisOne}</label>
              <label className="flex items-center gap-2"><input type="radio" className="h-4 w-4" checked={scope === "SERIES_FROM_HERE"} onChange={() => setScope("SERIES_FROM_HERE")} />{WORKPLAN_COPY.thisAndLater}</label>
            </div>
          )}
          {pendingRow.reasonRequired && (
            <Field label={WORKPLAN_COPY.whyMoved} error={state.fields?.reason?.[0]}>
              <Textarea dictate rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} required />
            </Field>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} pending={state.busy} disabled={pendingRow.reasonRequired && !reason.trim()}>Save</Button>
            <Button size="sm" variant="secondary" onClick={() => setPending(null)}>Undo</Button>
          </div>
          {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
        </div>
      )}
    </div>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`min-h-[32px] rounded-full border px-3 text-xs font-medium ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-700 dark:border-white/15 dark:bg-slate-900/40 dark:text-slate-200"}`}>
      {children}
    </button>
  );
}

/** The activity's name, its lead and its dates, in the column that stays in view. A series says how many repeats it has. */
function LaneName({ projectId, lane, names, today }: { projectId: string; lane: TimelineLane; names: Record<string, string>; today: string }) {
  const first = lane.bars[0]!;
  const lead = first.ownerUserId ? names[first.ownerUserId] : undefined;
  const second = lane.repeats > 1
    ? `${lane.repeats} repeats${lead ? ` · ${lead}` : ""}`
    : [lead, first.dates].filter(Boolean).join(" · ");
  const worst = lane.bars.some((b) => b.signal === "LATE") ? "LATE" : lane.bars.every((b) => b.signal === "DONE") ? "DONE" : lane.bars.every((b) => b.signal === "CANCELLED") ? "CANCELLED" : "ON_TIME";
  // A series opens at its next repeat that is still open, else its first.
  const target = lane.bars.find((b) => b.status === "PLANNED" || b.status === "IN_PROGRESS") ?? first;
  return (
    <div role="listitem" className="flex items-center gap-2 border-b border-slate-100 px-3 dark:border-white/5" style={{ height: LANE_ROW_PX }}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[worst]}`} title={first.signalLabel} aria-label={first.signalLabel} />
      <Link href={`/projects/${projectId}/activities/plan/${target.id}`} className="min-w-0 flex-1 leading-tight hover:underline" title={lane.title}>
        <span className={`block truncate text-xs font-medium text-slate-900 dark:text-slate-100 ${worst === "CANCELLED" ? "line-through" : ""}`}>{first.milestone ? "◆ " : ""}{lane.title}</span>
        <span className="block truncate text-[10px] text-slate-500">{second || today}</span>
      </Link>
    </div>
  );
}

function Legend() {
  const item = (cls: string, text: string) => <span className="inline-flex items-center gap-1"><span className={`inline-block h-2.5 w-4 rounded-sm ${cls}`} aria-hidden="true" />{text}</span>;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500" aria-label="What the colours mean">
      {item("bg-emerald-500/80", "On time")}{item("bg-red-500/85", "Late")}{item("bg-slate-400/80", "Done")}{item("bg-slate-300/70", "Cancelled")}
      <span>◆ one-day activity</span><span>⧗ waiting for another</span><span><span className="inline-block h-2.5 w-4 rounded-sm border border-dashed border-slate-400" aria-hidden="true" /> where it was first planned</span>
      <span><span className="text-red-600">▼</span> report due</span><span>Drag a bar to move it, its ends to change the dates, or the empty chart to scroll.</span>
    </p>
  );
}
