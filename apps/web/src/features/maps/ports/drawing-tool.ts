import type { BasemapMode, Bounds } from "../domain/model/scene.ts";
import type { DrawnShape } from "../domain/marking/area-rules.ts";

export interface DrawingToolOptions {
  basemap: BasemapMode;
  focus: Bounds | null;
  /** Boundary outlines for orientation, or null. */
  outline: unknown | null;
  /** A guide shape drawn dashed (the parent area's own outline), or null. */
  guide: unknown | null;
  /** The language of the map's own place names. */
  lang?: string | undefined;
}

export type DrawKind = "OUTLINE" | "ROUTE";

/**
 * Drawing one outline or route on a map. Separate from `MapRenderer` and `PinPlacer`: a read-only map never sees editing, and a form
 * that only pins a point never sees shapes. One shape at a time: starting a new one replaces the old.
 */
export interface DrawingTool {
  /** Shows an existing shape (null removes it). Does not call the handler. */
  load(shape: DrawnShape | null): void;
  /** Starts drawing a new shape, replacing the current one. */
  start(kind: DrawKind): void;
  /** Lets the person move, add and remove corners of the current shape. */
  edit(): void;
  /** Stops drawing or editing and leaves the map as a plain map. */
  stop(): void;
  /** Removes the current shape and reports null. */
  remove(): void;
  /** Called when a shape is finished, edited or removed: the shape as drawn (not yet checked; the domain does that), or null. */
  onChange(handler: (shape: DrawnShape | null) => void): void;
  dispose(): void;
}

export type DrawingToolFactory = (container: HTMLElement, options: DrawingToolOptions) => Promise<DrawingTool>;
