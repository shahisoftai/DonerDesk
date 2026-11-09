"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { canvasToWidgets, isContainerKind, repeatKey, topLevel, type BlockInstance, type BlockModel, type Canvas } from "@donordesk/domain/contexts/canvas/index.js";
import type { DashboardWidget } from "@donordesk/domain/contexts/dashboards/index.js";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { blockLabelKey } from "../domain/canvas-copy";
import { BlockBoundary } from "./BlockBoundary";
import { CanvasBlockView } from "./CanvasBlockView";
import { ContainerView } from "./ContainerView";
import { useMarquee } from "./use-marquee";
import type { Rect } from "@donordesk/domain/contexts/canvas/index.js";

interface Props {
  canvas: Canvas;
  blocks: readonly BlockInstance[];
  drawings: ReadonlyMap<string, ChartDrawing>;
  widgets: ReadonlyMap<string, DashboardWidget>;
  models: Record<string, BlockModel<unknown>> | undefined;
  repeats: Record<string, Array<{ key: string; label: string }>> | undefined;
  editing: boolean;
  /** Every selected block (editing can select several). */
  selectedIds: ReadonlySet<string>;
  onSelect: (id: string, how?: { shift?: boolean; mod?: boolean }) => void;
  /** Dragging over empty space: the cells covered and whether to add to the selection; a click on empty space has a 0 x 0 rectangle. */
  onMarquee?: ((cells: Rect, add: boolean) => void) | undefined;
  /** Draw the 12 columns behind the blocks. */
  showGrid?: boolean | undefined;
  onPick?: ((name: string) => void) | undefined;
  /** True when a block\'s settings differ from what the server last drew. */
  isChanged: (b: BlockInstance) => boolean;
  /** Wraps a block placed on the page grid (the editor adds its drag handles here). */
  frame?: ((b: BlockInstance, node: ReactNode) => ReactNode) | undefined;
}

/** One page of a canvas: the blocks on the 12-column grid, with container blocks drawing the blocks they hold. The editor and the page a link opens use this one component. */
export function CanvasPageGrid({ canvas, blocks, drawings, widgets, models, repeats, editing, selectedIds, onSelect, onMarquee, showGrid, onPick, isChanged, frame }: Props) {
  const { t } = useI18n();
  const gridRef = useRef<HTMLDivElement>(null);
  const modifiers = useRef<{ shift?: boolean; mod?: boolean }>({});
  const marquee = useMarquee(gridRef, editing && Boolean(onMarquee), (cells, add) => onMarquee?.(cells, add));
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
        <CanvasBlockView block={b} canvas={canvas} drawing={drawings.get(key)} widget={itemKey ? copies.get(key) : widgets.get(b.id)} serverModel={models?.[key]} changed={isChanged(b)} selected={selectedIds.has(b.id)} editing={editing} onSelect={() => onSelect(b.id, modifiers.current)} onPick={onPick} />
      </BlockBoundary>
    );
  };
  return (
    <div ref={gridRef} className={`relative grid grid-cols-1 gap-3 sm:grid-cols-12 sm:auto-rows-[5.5rem] ${showGrid ? "bg-[linear-gradient(to_right,rgba(14,116,144,0.08)_1px,transparent_1px)] bg-[length:calc((100%+0.75rem)/12)_100%]" : ""}`} dir={canvas.language === "ar" ? "rtl" : "ltr"} data-testid="canvas-grid" data-grid={showGrid || undefined}
      onPointerDownCapture={(e) => { modifiers.current = { shift: e.shiftKey, mod: e.ctrlKey || e.metaKey }; }} {...marquee.handlers}>
      {marquee.box && <div aria-hidden className="pointer-events-none absolute z-40 rounded border border-sky-600 bg-sky-500/10" style={{ left: marquee.box.x, top: marquee.box.y, width: marquee.box.w, height: marquee.box.h }} data-testid="marquee" />}
      {topLevel(blocks).map((b) => {
        const node = isContainerKind(b.kind)
          ? <div data-block={b.id} data-kind={b.kind} data-selected={selectedIds.has(b.id) || undefined} onClick={editing ? () => onSelect(b.id, modifiers.current) : undefined} className={`h-full rounded-xl ${selectedIds.has(b.id) ? "outline outline-2 outline-offset-2 outline-sky-600" : ""} ${b.style?.hidden ? "opacity-40" : ""}`}>
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
