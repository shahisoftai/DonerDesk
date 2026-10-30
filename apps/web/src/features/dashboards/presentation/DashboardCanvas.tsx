"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { GRID_COLUMNS, gridRows, moveWidget, readingOrder, removeWidget, resizeWidget, type DashboardWidget } from "@donordesk/domain/contexts/dashboards/index.js";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { DashboardChart } from "./DashboardChart";
import { KpiTileView } from "./KpiTileView";
import { MetricTileView } from "./MetricTileView";
import { MapWidget } from "./MapWidget";
import { canEditInPlace } from "./EditWidgetPanel";

const ROW_PX = 84;
const NARROW_PX = 640;

type Gesture = { id: string; kind: "move" | "resize"; startX: number; startY: number; base: DashboardWidget[] };

/**
 * The grid of charts. In edit mode a chart is moved by its title bar and resized by its corner (pointer), or with the keyboard:
 * arrow keys move it a cell, shift + arrows resize it. The layout is always computed by the domain's rules from where the gesture
 * began, so dragging back returns exactly where it was. A narrow screen shows the charts one under another and offers no dragging.
 */
export function DashboardCanvas({ widgets, charts, editing, onChange, labels, onPick, onEdit }: {
  /** Edit mode: open a widget's settings. Only widgets that can be changed in place show the button. */
  onEdit?: ((id: string) => void) | undefined;
  /** A click on a chart's bar, point or slice (not while editing). */
  onPick?: ((name: string) => void) | undefined;
  widgets: DashboardWidget[];
  charts: Map<string, ChartDrawing>;
  editing: boolean;
  onChange: (next: DashboardWidget[]) => void;
  /** A name for each chart's project, for the title bar. */
  labels: Record<string, string>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const gesture = useRef<Gesture | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  const narrow = width > 0 && width < NARROW_PX;
  const cell = width / GRID_COLUMNS;
  const ordered = useMemo(() => (narrow ? readingOrder(widgets) : widgets), [narrow, widgets]);

  function begin(e: ReactPointerEvent, id: string, kind: Gesture["kind"]) {
    if (!editing || narrow) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { id, kind, startX: e.clientX, startY: e.clientY, base: widgets };
  }
  function drag(e: ReactPointerEvent) {
    const g = gesture.current;
    if (!g || cell === 0) return;
    const dx = Math.round((e.clientX - g.startX) / cell);
    const dy = Math.round((e.clientY - g.startY) / ROW_PX);
    const origin = g.base.find((w) => w.id === g.id)!;
    onChange(g.kind === "move" ? moveWidget(g.base, g.id, origin.x + dx, origin.y + dy) : resizeWidget(g.base, g.id, origin.w + dx, origin.h + dy));
  }
  function end() { gesture.current = null; }

  function key(e: KeyboardEvent, w: DashboardWidget) {
    if (!editing || narrow) return;
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!step) return;
    e.preventDefault();
    onChange(e.shiftKey ? resizeWidget(widgets, w.id, w.w + step[0]!, w.h + step[1]!) : moveWidget(widgets, w.id, w.x + step[0]!, w.y + step[1]!));
  }

  return (
    <div ref={box} className="relative w-full" style={narrow ? undefined : { height: Math.max(gridRows(widgets), 4) * ROW_PX }}>
      {ordered.map((w) => {
        const drawing = charts.get(w.id);
        const style = narrow ? { height: w.h * ROW_PX } : { position: "absolute" as const, left: w.x * cell, top: w.y * ROW_PX, width: w.w * cell, height: w.h * ROW_PX };
        return (
          <section key={w.id} style={style} className={`${narrow ? "mb-3" : ""} p-1.5`} aria-label={drawing?.chart?.title ?? drawing?.table?.title ?? drawing?.kpi?.title ?? drawing?.metric?.title ?? drawing?.map?.title ?? "Chart"}>
            <div className={`flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-slate-900 ${editing ? "border-brand-400" : "border-slate-200 dark:border-slate-700"}`}>
              <div
                className={`flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5 text-sm dark:border-slate-800 ${editing && !narrow ? "cursor-move touch-none" : ""}`}
                tabIndex={editing && !narrow ? 0 : undefined}
                aria-label={editing && !narrow ? `Move ${drawing?.chart?.title ?? "chart"}. Arrow keys move it, Shift with arrow keys resizes it.` : undefined}
                onPointerDown={(e) => begin(e, w.id, "move")} onPointerMove={drag} onPointerUp={end} onPointerCancel={end} onKeyDown={(e) => key(e, w)}
              >
                <span className="truncate font-medium">{drawing?.chart?.title ?? drawing?.table?.title ?? drawing?.kpi?.title ?? drawing?.metric?.title ?? drawing?.map?.title ?? (w.kind === "TEXT" ? "Note" : "Chart")}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-xs text-slate-500 sm:inline">{labels[w.projectId] ?? ""}</span>
                  {editing && onEdit && canEditInPlace(w) && <button type="button" className="text-xs text-slate-500 underline" aria-label={`Edit ${drawing?.chart?.title ?? drawing?.table?.title ?? drawing?.kpi?.title ?? drawing?.metric?.title ?? drawing?.map?.title ?? (w.kind === "TEXT" ? "Note" : "widget")}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => onEdit(w.id)}>Edit</button>}
                  {editing && <button type="button" className="text-xs text-slate-500 underline" onPointerDown={(e) => e.stopPropagation()} onClick={() => onChange(removeWidget(widgets, w.id))}>Remove</button>}
                </span>
              </div>
              <div className="relative min-h-0 flex-1 p-1">
                {!drawing ? <p className="p-3 text-sm text-slate-500">{editing ? "Save the dashboard to draw this." : "Loading…"}</p>
                  : drawing.map ? <MapWidget view={drawing.map.view} projectId={drawing.map.projectId} />
                  : drawing.metric ? <MetricTileView metric={drawing.metric} />
                  : drawing.kpi ? <KpiTileView kpi={drawing.kpi} />
                  : drawing.text !== undefined ? <p className="whitespace-pre-wrap p-3 text-sm" data-testid="text-widget">{drawing.text}</p>
                  : drawing.table ? (
                    <div className="h-full overflow-auto" data-testid="table-widget">
                      <table className="w-full text-xs"><thead><tr>{drawing.table.columns.map((c) => <th key={c} className="border-b px-2 py-1 text-start">{c}</th>)}</tr></thead>
                        <tbody>{drawing.table.rows.map((r, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800">{r.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}</tr>)}</tbody></table>
                    </div>
                  ) : drawing.chart ? <DashboardChart option={drawing.chart.option} label={drawing.chart.title} maps={drawing.chart.maps} regionNames={drawing.chart.regionNames} onPick={editing ? undefined : onPick} /> : <p className="p-3 text-sm text-slate-500">{drawing.unavailable ?? "This chart cannot be drawn."}</p>}
              </div>
              {drawing?.chart && (drawing.chart.unverified > 0 || drawing.chart.notes.length > 0) && (
                <p className="border-t border-slate-100 px-3 py-1 text-xs text-slate-500 dark:border-slate-800">
                  {[drawing.chart.unverified > 0 ? `${drawing.chart.unverified} of ${drawing.chart.points} values not verified yet` : "", ...drawing.chart.notes].filter(Boolean).join(" · ")}
                </p>
              )}
              {editing && !narrow && (
                <div
                  className="absolute bottom-1.5 right-1.5 h-4 w-4 cursor-se-resize touch-none rounded-sm border-b-2 border-r-2 border-brand-500"
                  aria-hidden
                  onPointerDown={(e) => begin(e, w.id, "resize")} onPointerMove={drag} onPointerUp={end} onPointerCancel={end}
                />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
