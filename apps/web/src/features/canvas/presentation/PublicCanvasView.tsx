"use client";

import { useMemo } from "react";
import { canvasToWidgets, type BlockModel, type Canvas } from "@donordesk/domain/contexts/canvas/index.js";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { blockLabelKey } from "../domain/canvas-copy";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { BlockBoundary } from "./BlockBoundary";
import { CanvasBlockView } from "./CanvasBlockView";

/** The read-only canvas a link holder sees: the same blocks as the editor, never editable, drawn from what the server read as a guest. */
export function PublicCanvasView({ canvas, drawings, models }: { canvas: Canvas; drawings: ChartDrawing[]; models: Record<string, BlockModel<unknown>> }) {
  const { t } = useI18n();
  const widgets = useMemo(() => new Map(canvasToWidgets(canvas, undefined).widgets.map((w) => [w.id, w])), [canvas]);
  const byId = useMemo(() => new Map(drawings.map((d) => [d.widgetId, d])), [drawings]);
  return (
    <div className="space-y-6" dir={canvas.language === "ar" ? "rtl" : "ltr"}>
      {canvas.pages.map((page) => (
        <section key={page.id} aria-label={page.title}>
          {canvas.pages.length > 1 && <h2 className="mb-2 text-lg font-semibold">{page.title}</h2>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:auto-rows-[5.5rem]">
            {page.blocks.filter((b) => b.style?.hidden !== true).map((b) => (
              <div key={b.id} className="h-[var(--mh)] sm:h-auto sm:[grid-column:var(--c)/span_var(--w)] sm:[grid-row:var(--r)/span_var(--h)]" style={{ "--c": b.bounds.x + 1, "--w": b.bounds.w, "--r": b.bounds.y + 1, "--h": b.bounds.h, "--mh": `${Math.max(b.bounds.h, 1) * 5.5}rem` } as React.CSSProperties}>
                <BlockBoundary label={t(blockLabelKey(b.kind as never))}><CanvasBlockView block={b} canvas={canvas} drawing={byId.get(b.id)} widget={widgets.get(b.id)} serverModel={models[b.id]} changed={false} selected={false} editing={false} onSelect={() => undefined} /></BlockBoundary>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
