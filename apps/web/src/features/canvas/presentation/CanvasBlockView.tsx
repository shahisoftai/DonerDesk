"use client";

import { useMemo, type KeyboardEvent } from "react";
import { definitionFor, isDashboardKind, themeFor, type BlockInstance, type BlockModel, type Canvas, type PaintFrame } from "@donordesk/domain/contexts/canvas/index.js";
import type { DashboardWidget } from "@donordesk/domain/contexts/dashboards/index.js";
import { Tile } from "@/components/ui/Tile";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { rendererFor } from "@/features/dashboards/presentation/widgets/registry";
import { blockLabelKey } from "../domain/canvas-copy";
import { themeChartOption } from "../domain/theme-chart";
import { screenRendererFor } from "./screen-registry";
import { NothingToShow, screenText } from "./screens/screen-text";

interface Props {
  block: BlockInstance;
  canvas: Canvas;
  drawing: ChartDrawing | undefined;
  widget: DashboardWidget | undefined;
  /** The model the server resolved for this block, if any. */
  serverModel: BlockModel<unknown> | undefined;
  /** The block's settings differ from what was saved: the server's figures are out of date until the next save. */
  changed: boolean;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  /** A click on a bar, point or slice reports its label; the page decides what filter that means. */
  onPick?: ((name: string) => void) | undefined;
}

/** A block's model: what it says now. A block that needs no records is worked out here as it is edited; one that does uses the server's, and says so when it is out of date. */
export function modelOf(block: BlockInstance, serverModel: BlockModel<unknown> | undefined, changed: boolean): BlockModel<unknown> {
  const def = definitionFor(block.kind) as unknown as { resolve(props: unknown, data: unknown): BlockModel<unknown> } | undefined;
  const local = def ? def.resolve(block.props, undefined) : ({ state: "unavailable", reason: "This block is not one the product knows." } as const);
  if (!serverModel) return local;
  return changed && local.state !== "unavailable" ? local : serverModel;
}

export function CanvasBlockView({ block, canvas, drawing, widget, serverModel, changed, selected, editing, onSelect, onPick }: Props) {
  const { t } = useI18n();
  const def = definitionFor(block.kind);
  const label = t(blockLabelKey(block.kind as never));
  const frame: PaintFrame = useMemo(() => ({ theme: themeFor(canvas.themeId), size: { w: block.bounds.w, h: block.bounds.h }, language: canvas.language, rtl: canvas.language === "ar" }), [canvas.themeId, canvas.language, block.bounds.w, block.bounds.h]);
  const hidden = block.style?.hidden === true;
  const heading = (block.props as { title?: string } | undefined)?.title;
  const keyDown = (e: KeyboardEvent): void => { if (editing && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onSelect(); } };

  let body: React.ReactNode;
  let title = heading || label;
  if (drawing && widget) {
    // The page's look reaches the chart on screen as it does in a file.
    const themed: ChartDrawing = drawing.chart ? { ...drawing, chart: { ...drawing.chart, option: themeChartOption(drawing.chart.option, frame.theme) } } : drawing;
    const renderer = rendererFor(themed);
    title = renderer.title({ widget, drawing: themed }) ?? label;
    body = renderer.render({ widget, drawing: themed, onPick: editing ? undefined : onPick });
  } else if (isDashboardKind(block.kind)) {
    // A chart-style block is drawn from the records by the server: a block just added or changed has no figures until the canvas is saved.
    body = <NothingToShow text={screenText(frame)} reason={editing ? "Reading the figures…" : "Nothing to show yet."} authoring />;
  } else {
    const model = modelOf(block, serverModel, changed);
    const Screen = screenRendererFor(block.kind);
    // A prompt ("Write the callout.") is for the person editing; a reader sees nothing where nothing was written.
    if (!editing && model.state === "empty" && model.authoring === true) return null;
    if (Screen) body = <Screen model={model} frame={frame} />;
    else body = <PendingPreview text={screenText(frame)} reason={def ? "A preview of this block is not available yet. It is included when you publish." : "This block is not one the product knows."} />;
  }

  return (
    <div role={editing ? "button" : undefined} tabIndex={editing ? 0 : undefined} onClick={editing ? onSelect : undefined} onKeyDown={keyDown} aria-pressed={editing ? selected : undefined} aria-label={editing ? `${label}${hidden ? " (hidden)" : ""}` : undefined}
      data-block={block.id} data-kind={block.kind} data-selected={selected || undefined} data-hidden={hidden || undefined}
      className={`h-full rounded-xl ${editing ? "cursor-pointer" : ""} ${selected ? "outline outline-2 outline-offset-2 outline-sky-600" : ""} ${hidden ? "opacity-40" : ""}`}>
      {def?.bare === true && !(drawing && widget)
        ? <div className="h-full min-h-0 overflow-auto" aria-label={title}>{body}</div>
        : <Tile title={title} status="ready" ariaLabel={`${title}`} flush {...(changed && editing ? { subtitle: "Updating…" } : {})}><div className="h-full min-h-0 overflow-auto">{body}</div></Tile>}
    </div>
  );
}

function PendingPreview({ text, reason }: { text: ReturnType<typeof screenText>; reason: string }) {
  return <NothingToShow text={text} reason={reason} />;
}
