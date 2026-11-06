"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { GRID_COLUMNS, gridRows, mobileRows, moveWidget, readingOrder, removeWidget, resizeWidget, type DashboardWidget } from "@donordesk/domain/contexts/dashboards/index.js";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { Tile } from "@/components/ui/Tile";
import { rendererFor } from "./widgets/registry";
import { TextBlock } from "./TextBlock";
import { canEditInPlace } from "./EditWidgetPanel";

/** A chart that cannot be drawn still keeps the name it was given (a template names each chart), so the tile says which one it is. */
const ownTitle = (w: DashboardWidget): string | undefined => {
  const named = [(w.spec as { title?: unknown } | undefined)?.title, w.map?.title, w.metric?.title, w.kpi?.title, w.projectList?.title];
  const t = named.find((x) => typeof x === "string" && x.trim() !== "");
  return typeof t === "string" ? t.trim() : undefined;
};

const ROW_PX = 84;
const NARROW_PX = 640;

type Gesture = { id: string; kind: "move" | "resize"; startX: number; startY: number; base: DashboardWidget[] };

/**
 * The grid of charts. In edit mode a chart is moved by its title bar and resized by its corner (pointer), or with the keyboard:
 * arrow keys move it a cell, shift + arrows resize it. The layout is always computed by the domain's rules from where the gesture
 * began, so dragging back returns exactly where it was. A narrow screen shows the charts one under another and offers no dragging.
 */
export function DashboardCanvas({ widgets, charts, editing, onChange, labels, onPick, onEdit, fitHeight, hoverName, onHover }: {
  hoverName?: string | null | undefined;
  onHover?: ((name: string | null) => void) | undefined;
  /** Wall display: stretch the rows so the whole dashboard fills this many pixels (never smaller than the normal row). */
  fitHeight?: number | undefined;
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
  const totalRows = Math.max(gridRows(widgets), 4);
  const rowPx = !narrow && fitHeight ? Math.max(ROW_PX, Math.floor(fitHeight / totalRows)) : ROW_PX;
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
    const dy = Math.round((e.clientY - g.startY) / rowPx);
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
    <div ref={box} data-dashboard-canvas id="dashboard-canvas" className="relative w-full" style={narrow ? undefined : { height: totalRows * rowPx }}>
      {ordered.map((w) => {
        const drawing = charts.get(w.id);
        const renderer = drawing ? rendererFor(drawing) : undefined;
        const title = (drawing && renderer ? renderer.title({ widget: w, drawing }) : undefined) ?? ownTitle(w) ?? (w.kind === "TEXT" ? "Note" : "Chart");
        const subtitle = drawing && renderer?.subtitle ? renderer.subtitle({ widget: w, drawing }) : undefined;
        const style = narrow ? { height: mobileRows(w.kind, w.h) * ROW_PX } : { position: "absolute" as const, left: w.x * cell, top: w.y * rowPx, width: w.w * cell, height: w.h * rowPx };
        const movable = editing && !narrow;
        const chart = drawing?.chart;
        const status = drawing || w.kind === "TEXT" ? "ready" : "loading";
        return (
          <div key={w.id} style={style} className={`${narrow ? "mb-3" : ""} p-1.5`}>
            <Tile
              title={title}
              ariaLabel={title}
              {...(subtitle ? { subtitle } : {})}
              status={status}
              editing={editing}
              className="relative"
              flush
              unverified={chart?.unverified}
              headerProps={{
                className: movable ? "cursor-move touch-none" : "",
                tabIndex: movable ? 0 : undefined,
                "aria-label": movable ? `Move ${title}. Arrow keys move it, Shift with arrow keys resizes it.` : undefined,
                onPointerDown: (e) => begin(e, w.id, "move"), onPointerMove: drag, onPointerUp: end, onPointerCancel: end, onKeyDown: (e) => key(e, w),
              }}
              headerSlot={(
                <span className="flex min-w-0 max-w-[45%] items-center gap-2">
                  <span className="hidden min-w-0 truncate text-xs text-[var(--tile-meta)] sm:inline">{labels[w.projectId] ?? ""}</span>
                  {editing && onEdit && canEditInPlace(w) && <button type="button" className="shrink-0 text-xs text-[var(--tile-meta)] underline [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-2" aria-label={`Edit ${title}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => onEdit(w.id)}>Edit</button>}
                  {editing && <button type="button" className="shrink-0 text-xs text-[var(--tile-meta)] underline [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-2" onPointerDown={(e) => e.stopPropagation()} onClick={() => onChange(removeWidget(widgets, w.id))}>Remove</button>}
                </span>
              )}
            >
              {drawing && renderer
                ? renderer.render({ widget: w, drawing, onPick: editing ? undefined : onPick, hoverName, onHover: editing ? undefined : onHover })
                : w.kind === "TEXT" ? <TextBlock text={w.text ?? ""} /> : null}
              {chart && chart.notes.length > 0 && <p className="border-t border-[var(--tile-border)] px-2 pt-1 text-xs text-[var(--tile-meta)]">{chart.notes.join(" · ")}</p>}
              {movable && (
                <div
                  className="absolute bottom-0 right-0 h-6 w-6 cursor-se-resize touch-none rounded-br-xl border-b-2 border-r-2 border-brand-500 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
                  aria-hidden
                  onPointerDown={(e) => begin(e, w.id, "resize")} onPointerMove={drag} onPointerUp={end} onPointerCancel={end}
                />
              )}
            </Tile>
          </div>
        );
      })}
    </div>
  );
}
