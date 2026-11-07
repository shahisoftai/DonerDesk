"use client";

import { useMemo, type ReactNode } from "react";
import { canvasToWidgets, isContainerKind, repeatKey, topLevel, type BlockInstance, type BlockModel, type Canvas } from "@donordesk/domain/contexts/canvas/index.js";
import type { DashboardWidget } from "@donordesk/domain/contexts/dashboards/index.js";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { blockLabelKey } from "../domain/canvas-copy";
import { BlockBoundary } from "./BlockBoundary";
import { CanvasBlockView } from "./CanvasBlockView";
import { ContainerView } from "./ContainerView";

interface Props {
  canvas: Canvas;
  blocks: readonly BlockInstance[];
  drawings: ReadonlyMap<string, ChartDrawing>;
  widgets: ReadonlyMap<string, DashboardWidget>;
  models: Record<string, BlockModel<unknown>> | undefined;
  repeats: Record<string, Array<{ key: string; label: string }>> | undefined;
  editing: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPick?: ((name: string) => void) | undefined;
  /** True when a block\'s settings differ from what the server last drew. */
  isChanged: (b: BlockInstance) => boolean;
  /** Wraps a block placed on the page grid (the editor adds its drag handles here). */
  frame?: ((b: BlockInstance, node: ReactNode) => ReactNode) | undefined;
}

/** One page of a canvas: the blocks on the 12-column grid, with container blocks drawing the blocks they hold. The editor and the page a link opens use this one component. */
export function CanvasPageGrid({ canvas, blocks, drawings, widgets, models, repeats, editing, selectedId, onSelect, onPick, isChanged, frame }: Props) {
  const { t } = useI18n();
  const label = (kind: string): string => t(blockLabelKey(kind as never));
  // A project repeater draws its held chart-style blocks once per project: the widget for each copy reads that project.
  const copies = useMemo(() => {
    const out = new Map<string, DashboardWidget>();
    for (const holder of blocks) {
      const over = (holder.props as { over?: string } | undefined)?.over;
      if (over !== "PROJECT") continue;
      for (const it of repeats?.[holder.id] ?? []) for (const child of blocks.filter((b) => b.container?.id === holder.id)) {
        const made = canvasToWidgets({ ...canvas, pages: [{ id: "x", title: "x", format: "WEB_FLUID", blocks: [{ ...child, container: undefined, bindings: [] }] }] }, it.key).widgets[0];
        if (made) out.set(repeatKey(child.id, it.key), { ...made, id: repeatKey(child.id, it.key), projectId: it.key });
      }
    }
    return out;
  }, [blocks, repeats, canvas]);

  const renderBlock = (b: BlockInstance, itemKey?: string): ReactNode => {
    const key = itemKey ? repeatKey(b.id, itemKey) : b.id;
    return (
      <BlockBoundary label={label(b.kind)}>
        <CanvasBlockView block={b} canvas={canvas} drawing={drawings.get(key)} widget={itemKey ? copies.get(key) : widgets.get(b.id)} serverModel={models?.[key]} changed={isChanged(b)} selected={selectedId === b.id} editing={editing} onSelect={() => onSelect(b.id)} onPick={onPick} />
      </BlockBoundary>
    );
  };
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:auto-rows-[5.5rem]" dir={canvas.language === "ar" ? "rtl" : "ltr"} data-testid="canvas-grid">
      {topLevel(blocks).map((b) => {
        const node = isContainerKind(b.kind)
          ? <div data-block={b.id} data-kind={b.kind} data-selected={selectedId === b.id || undefined} onClick={editing ? () => onSelect(b.id) : undefined} className={`h-full rounded-xl ${selectedId === b.id ? "outline outline-2 outline-offset-2 outline-sky-600" : ""} ${b.style?.hidden ? "opacity-40" : ""}`}>
              <ContainerView block={b} blocks={blocks} renderChild={renderBlock} items={repeats?.[b.id]} editing={editing} />
            </div>
          : renderBlock(b);
        const placed = frame ? frame(b, node) : node;
        return (
          <div key={b.id} className="h-[var(--mh)] sm:h-auto sm:[grid-column:var(--c)/span_var(--w)] sm:[grid-row:var(--r)/span_var(--h)]" style={{ "--c": b.bounds.x + 1, "--w": b.bounds.w, "--r": b.bounds.y + 1, "--h": b.bounds.h, "--mh": `${Math.max(b.bounds.h, 1) * 5.5}rem` } as React.CSSProperties}>{placed}</div>
        );
      })}
    </div>
  );
}
