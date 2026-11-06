/**
 * What a renderer is allowed to see (Phase 45, interface segregation). A screen renderer (React, in the web app) and a print
 * renderer (SVG text, on the server) are given the block's resolved model, the theme and the size - never the canvas, the
 * database or the viewer's whole session. Both paint the same `BlockModel`, so a figure, a gap or a note cannot differ between
 * the screen and an exported file; only the paint can.
 */
import type { BlockModel } from "./block-definition.js";
import type { CanvasBounds } from "./canvas.js";
import type { CanvasTheme } from "./theme.js";

export const RENDER_SURFACES = ["SCREEN", "PRINT"] as const;
export type RenderSurface = (typeof RENDER_SURFACES)[number];

export interface PaintFrame {
  theme: CanvasTheme;
  /** Size in grid cells; the renderer scales it to pixels or points itself. */
  size: Pick<CanvasBounds, "w" | "h">;
  language: string;
  rtl: boolean;
}

/** A painter for one block kind and one surface. `Out` is a React node on the screen and an SVG string in print. */
export type BlockPainter<M, Out> = (model: BlockModel<M>, frame: PaintFrame) => Out;
