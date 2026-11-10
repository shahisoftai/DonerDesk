import type { ReactNode } from "react";
import type { DashboardWidget } from "@donordesk/domain/contexts/dashboards/index.js";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import type { AnimationSpec } from "@donordesk/domain/contexts/canvas/index.js";

/** What a widget renderer is given. A renderer draws the body only; the frame, title and states belong to `Tile`. */
export interface WidgetContext {
  widget: DashboardWidget;
  drawing: ChartDrawing;
  /** A click on a bar, point or slice (undefined while editing). */
  onPick?: ((name: string) => void) | undefined;
  /** The label pointed at in any chart, and the way to report one. */
  hoverName?: string | null | undefined;
  onHover?: ((name: string | null) => void) | undefined;
  /** A "count up" motion for a figure tile; the figure always ends on the exact recorded value. */
  countUp?: AnimationSpec | undefined;
}

/** One kind of widget: says whether a drawing is its kind, and draws it. Registered in `registry.tsx`; the canvas never names a kind. */
export interface WidgetRenderer {
  key: string;
  matches: (drawing: ChartDrawing) => boolean;
  /** The title shown in the tile header. */
  title: (ctx: WidgetContext) => string | undefined;
  /** An optional second line under the title (a chart's unit or period). */
  subtitle?: (ctx: WidgetContext) => string | undefined;
  render: (ctx: WidgetContext) => ReactNode;
}
