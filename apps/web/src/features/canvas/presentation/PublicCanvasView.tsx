"use client";

import { useMemo } from "react";
import { canvasToWidgets, type BlockModel, type Canvas } from "@donordesk/domain/contexts/canvas/index.js";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { CanvasPageGrid } from "./CanvasPageGrid";

const NO_SELECTION: ReadonlySet<string> = new Set();

/** The read-only canvas a link holder sees: the same blocks as the editor, never editable, drawn from what the server read as a guest. */
export function PublicCanvasView({ canvas, drawings, models, repeats }: { canvas: Canvas; drawings: ChartDrawing[]; models: Record<string, BlockModel<unknown>>; repeats?: Record<string, Array<{ key: string; label: string }>> }) {
  const widgets = useMemo(() => new Map(canvasToWidgets(canvas, undefined).widgets.map((w) => [w.id, w])), [canvas]);
  const byId = useMemo(() => new Map(drawings.map((d) => [d.widgetId, d])), [drawings]);
  return (
    <div className="space-y-6" dir={canvas.language === "ar" ? "rtl" : "ltr"}>
      {canvas.pages.map((page) => (
        <section key={page.id} aria-label={page.title}>
          {canvas.pages.length > 1 && <h2 className="mb-2 text-lg font-semibold">{page.title}</h2>}
          <CanvasPageGrid canvas={canvas} blocks={page.blocks.filter((b) => b.style?.hidden !== true)} drawings={byId} widgets={widgets} models={models} repeats={repeats} editing={false} selectedIds={NO_SELECTION} onSelect={() => undefined} isChanged={() => false} />
        </section>
      ))}
    </div>
  );
}
