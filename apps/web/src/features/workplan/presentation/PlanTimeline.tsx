"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WORKPLAN_COPY, formatShortDate } from "@donordesk/domain/contexts/workplan/index.js";
import type { WorkPlanRow } from "@/lib/server/schemas";
import { dependencyLinks, elbowPath, waitingLine } from "../domain/dependency-view";
import { cascadePreview } from "../domain/cascade-preview";
import { reschedulePlannedActivityAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { applyDrag, confirmQuestion, isDraggable, keyboardDrag, pixelsToDays, type DragMode } from "../domain/timeline-drag";
import { layoutTimeline, timelineRange, TIMELINE_ZOOMS, TIMELINE_ZOOM_LABEL, type DateRange, type TimelineDeadline, type TimelineZoom } from "../domain/timeline-layout";

const ZOOM_KEY = "donordesk.timeline-zoom";
const HANDLE_PX = 8;
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
export function PlanTimeline({ projectId, rows, deadlines, project, today, outputTitles, movableIds }: {
  projectId: string;
  rows: WorkPlanRow[];
  deadlines: TimelineDeadline[];
  project: DateRange;
  today: string;
  outputTitles: Record<string, string>;
  /** Ids of the activities this person may move (decided on the server). */
  movableIds: string[];
}) {
  const router = useRouter();
  const state = useActionState();
  const track = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [zoom, setZoom] = useState<TimelineZoom>("QUARTER");
  const [pending, setPending] = useState<Pending | null>(null);
  const [scope, setScope] = useState<"THIS" | "SERIES_FROM_HERE">("THIS");
  const [reason, setReason] = useState("");

  useEffect(() => {
    try { const saved = window.localStorage.getItem(ZOOM_KEY); if (saved && (TIMELINE_ZOOMS as readonly string[]).includes(saved)) setZoom(saved as TimelineZoom); } catch { /* storage blocked: keep the default */ }
  }, []);
  const chooseZoom = (z: TimelineZoom) => { setZoom(z); try { window.localStorage.setItem(ZOOM_KEY, z); } catch { /* remembered next time only if storage works */ } };

  const range = timelineRange(zoom, today, project);
  const shown = useMemo(() => rows.map((r) => (pending && pending.id === r.id ? { ...r, plannedStart: pending.start, plannedEnd: pending.end } : r)), [rows, pending]);
  const layout = useMemo(
    () => layoutTimeline({ rows: shown.map((r) => ({ ...r, waitingLabel: waitingLine(r.waitingFor) })), deadlines, range, zoom, today, outputTitles: new Map(Object.entries(outputTitles)) }),
    [shown, deadlines, range, zoom, today, outputTitles],
  );
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const pendingRow = pending ? byId.get(pending.id) : undefined;
  // What else moves (or stays put) if this move is saved: the activities that wait for the moved one, by the domain's own rule.
  const cascade = useMemo(() => (pending ? cascadePreview(rows, pending.id, pending.start, pending.end) : null), [pending, rows]);

  // Arrows between activities that come after one another: drawn from where the bars actually are, so they follow zoom,
  // resizing and a drag in progress. Decorative: the same information is in each bar's label ("Waiting for …").
  const bars = useRef(new Map<string, HTMLElement>());
  const [arrows, setArrows] = useState<Array<{ key: string; d: string; finished: boolean }>>([]);
  const links = useMemo(() => dependencyLinks(rows, new Set(layout.groups.flatMap((g) => g.bars.map((b) => b.id)))), [rows, layout]);
  useLayoutEffect(() => {
    const draw = () => {
      const box = track.current?.getBoundingClientRect();
      if (!box) return;
      const rel = (id: string) => {
        const r = bars.current.get(id)?.getBoundingClientRect();
        return r ? { x: r.left - box.left, y: r.top - box.top, width: r.width, height: r.height } : null;
      };
      setArrows(links.flatMap((l) => {
        const a = rel(l.fromId);
        const b = rel(l.toId);
        return a && b ? [{ key: `${l.fromId}>${l.toId}`, d: elbowPath(a, b), finished: l.finished }] : [];
      }));
    };
    draw();
    const el = track.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    return () => observer.disconnect();
  }, [links, layout, zoom]);

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

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Zoom" className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-white/15">
        {TIMELINE_ZOOMS.map((z) => (
          <button key={z} type="button" aria-pressed={zoom === z} onClick={() => chooseZoom(z)}
            className={`min-h-[32px] px-3 text-xs font-medium ${zoom === z ? "bg-brand-600 text-white" : "bg-white text-slate-700 dark:bg-slate-900/40 dark:text-slate-200"}`}>
            {TIMELINE_ZOOM_LABEL[z]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 p-3 dark:border-white/10">
        <div className="min-w-[640px]">
          {/* Ticks and the report-deadline lane */}
          <div className="relative h-6 border-b border-slate-200 text-[10px] text-slate-500 dark:border-white/10" aria-hidden="true">
            {layout.ticks.map((t, i) => <span key={i} className="absolute -translate-x-1/2" style={{ left: `${t.leftPct}%` }}>{t.label}</span>)}
          </div>
          <div className="relative h-7" role="list" aria-label="Report deadlines">
            {layout.deadlines.map((d, i) => (
              <span key={i} role="listitem" title={d.label} aria-label={d.label}
                className={`absolute top-1 -translate-x-1/2 text-xs ${d.kind === "DEADLINE" ? "text-red-600" : "text-amber-600"}`} style={{ left: `${d.leftPct}%` }}>
                {d.kind === "DEADLINE" ? "▼" : "▽"}
              </span>
            ))}
          </div>

          <div ref={track} className="relative">
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
            {layout.groups.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nothing is planned in this period.{layout.hidden > 0 ? ` ${layout.hidden} planned outside it.` : ""}</p>}
            {layout.groups.map((g) => (
              <div key={g.outputId ?? "other"} className="py-2">
                <p className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{g.title}</p>
                {g.bars.map((b) => {
                  const row = byId.get(b.id)!;
                  const draggable = isDraggable(row.status, movableIds.includes(row.id));
                  const isPending = pending?.id === b.id;
                  return (
                    <div key={b.id} className="relative mb-1 h-7">
                      {b.original && <div className="absolute top-0 h-7 rounded border border-dashed border-slate-400/70" style={{ left: `${b.original.leftPct}%`, width: `${Math.max(b.original.widthPct, 0.8)}%` }} aria-hidden="true" />}
                      <button
                        type="button"
                        ref={(el) => { if (el) bars.current.set(b.id, el); else bars.current.delete(b.id); }}
                        aria-label={b.label + (draggable ? ". Use the arrow keys to change the dates." : "")}
                        title={b.waiting ? `${b.label}. ${b.waiting}` : b.label}
                        onPointerDown={(e) => down(e, row)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
                        onClick={() => click(row)} onKeyDown={(e) => key(e, row)}
                        className={`absolute top-0 flex h-7 items-center overflow-hidden px-2 text-left text-xs ${b.milestone ? "rounded-sm" : "rounded"} ${SIGNAL_CLASS[b.signal]} ${draggable ? "cursor-grab touch-none" : ""} ${isPending ? "opacity-60 ring-2 ring-brand-500" : ""}`}
                        style={{ left: `${b.leftPct}%`, width: `${Math.max(b.widthPct, 1.6)}%`, minWidth: b.milestone ? 18 : undefined }}
                      >
                        {b.progressPct !== undefined && <span className="pointer-events-none absolute inset-y-0 left-0 bg-black/20" style={{ width: `${b.progressPct}%` }} aria-hidden="true" />}
                        <span className="relative truncate">{b.milestone ? "◆ " : ""}{b.waiting ? "⧗ " : ""}{b.title}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {layout.hidden > 0 && layout.groups.length > 0 && <p className="text-xs text-slate-500">{layout.hidden} planned outside this period.</p>}

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
