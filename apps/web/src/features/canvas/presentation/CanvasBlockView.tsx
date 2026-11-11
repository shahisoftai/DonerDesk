"use client";

import { useMemo, type KeyboardEvent } from "react";
import { canvasThemeOf, definitionFor, formatHints, isDashboardKind, type BlockInstance, type BlockModel, type Canvas, type PaintFrame } from "@donordesk/domain/contexts/canvas/index.js";
import type { DashboardWidget } from "@donordesk/domain/contexts/dashboards/index.js";
import { Tile } from "@/components/ui/Tile";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { rendererFor } from "@/features/dashboards/presentation/widgets/registry";
import { blockLabelKey } from "../domain/canvas-copy";
import { themeChartOption } from "../domain/theme-chart";
import { motionChartOption, motionStyle } from "../domain/motion-style";
import { screenRendererFor } from "./screen-registry";
import { NothingToShow, screenText } from "./screens/screen-text";
import { frameCss, titleCss } from "../domain/format-style";

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
  const frame: PaintFrame = useMemo(() => ({ theme: canvasThemeOf(canvas), size: { w: block.bounds.w, h: block.bounds.h }, language: canvas.language, rtl: canvas.language === "ar" }), [canvas, block.bounds.w, block.bounds.h]);
  const hidden = block.style?.hidden === true;
  const heading = (block.props as { title?: string } | undefined)?.title;
  const keyDown = (e: KeyboardEvent): void => { if (editing && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onSelect(); } };

  let body: React.ReactNode;
  let title = heading || label;
  if (drawing && widget) {
    // The page's look reaches the chart on screen as it does in a file.
    const themed: ChartDrawing = drawing.chart ? { ...drawing, chart: { ...drawing.chart, option: motionChartOption(themeChartOption(drawing.chart.option, frame.theme), block.motion) } } : drawing;
    const renderer = rendererFor(themed);
    title = renderer.title({ widget, drawing: themed }) ?? label;
    body = renderer.render({ widget, drawing: themed, onPick: editing ? undefined : onPick, countUp: block.motion?.animation === "COUNT_UP" ? block.motion : undefined });
    // A tile that draws with the product's own series colour takes the page's look through the variable it reads.
    if (canvas.themeId && canvas.themeId !== "DEFAULT") body = <div className="h-full min-h-0" style={{ ["--viz-1" as string]: frame.theme.accent, ["--viz-2" as string]: frame.theme.accent2 }}>{body}</div>;
  } else if (isDashboardKind(block.kind)) {
    // A chart-style block is drawn from the records by the server: a block just added or changed has no figures until the canvas is saved.
    body = <NothingToShow text={screenText(frame)} reason={editing ? "Reading the figures…" : "Nothing to show yet."} authoring />;
  } else {
    const model = modelOf(block, serverModel, changed);
    const Screen = screenRendererFor(block.kind);
    // A prompt ("Write the callout.") is for the person editing; a reader sees nothing where nothing was written.
    if (!editing && model.state === "empty" && model.authoring === true) return null;
    if (Screen) body = <Screen model={model} frame={frame} format={block.format} />;
    else body = <PendingPreview text={screenText(frame)} reason={def ? "A preview of this block is not available yet. It is included when you publish." : "This block is not one the product knows."} />;
  }

  // A block that fades or rises in is wrapped; the keyframes are skipped in print and for a viewer who asked for reduced motion (see globals.css).
  const entrance = motionStyle(block.motion);
  if (entrance) body = <div className="dd-motion h-full min-h-0" style={entrance}>{body}</div>;

  // Formatting (Phase 50.2): a block with its own title, border or accent bar draws its own frame from the same hints a file uses.
  const fmt = block.format;
  const hints = fmt ? formatHints(fmt, frame.theme) : null;
  const ownFrame = Boolean(fmt && (fmt.title || fmt.frame || fmt.accentBar));
  const shownTitle = hints?.title.show === false ? null : title;
  const visibility = `${fmt?.visibility?.hideOnPhone ? "hidden sm:block" : ""} ${fmt?.visibility?.hideOnPrint ? "print:hidden" : ""}`;

  return (
    <div role={editing ? "button" : undefined} tabIndex={editing ? 0 : undefined} onClick={editing ? onSelect : undefined} onKeyDown={keyDown} aria-pressed={editing ? selected : undefined} aria-label={editing ? `${label}${hidden ? " (hidden)" : ""}` : undefined}
      data-block={block.id} data-kind={block.kind} data-selected={selected || undefined} data-hidden={hidden || undefined}
      className={`h-full rounded-xl ${visibility} ${editing ? "cursor-pointer" : ""} ${selected ? "outline outline-2 outline-offset-2 outline-sky-600" : ""} ${hidden ? "opacity-40" : ""}`}>
      {ownFrame && hints
        ? <section aria-label={title} data-formatted className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--tile-border)] bg-[var(--tile-bg)] text-[var(--tile-title)] shadow-sm" style={frameCss(hints)}>
            {shownTitle && <header className="px-3 pt-2"><h3 style={titleCss(hints)}>{shownTitle}</h3>{hints.title.subtitle && <p className="text-xs text-[var(--tile-meta)]">{hints.title.subtitle}</p>}</header>}
            <div className="min-h-0 flex-1 overflow-auto">{body}</div>
          </section>
        : def?.bare === true && !(drawing && widget)
        ? <div className={`h-full min-h-0 ${def?.family === "CONTROLS" ? "overflow-visible" : "overflow-auto"}`} aria-label={title}>{body}</div>
        : <Tile title={title} status="ready" ariaLabel={`${title}`} flush {...(changed && editing ? { subtitle: "Updating…" } : {})}><div className="h-full min-h-0 overflow-auto">{body}</div></Tile>}
    </div>
  );
}

function PendingPreview({ text, reason }: { text: ReturnType<typeof screenText>; reason: string }) {
  return <NothingToShow text={text} reason={reason} />;
}
