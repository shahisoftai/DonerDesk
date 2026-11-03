import type { GeoJSONStoreFeatures, TerraDraw } from "terra-draw";
import type * as ML from "maplibre-gl";
import type { DrawnShape } from "../../domain/marking/area-rules.ts";
import type { BasemapSource } from "../../ports/basemap-source.ts";
import type { DrawKind, DrawingTool, DrawingToolOptions } from "../../ports/drawing-tool.ts";
import { openMap } from "./base-map.ts";

const SHAPE_COLOR = "#dc2626";
const EDITABLE = { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } };

const isShape = (g: { type: string }): g is DrawnShape & { type: "Polygon" | "LineString" } => g.type === "Polygon" || g.type === "LineString";

/**
 * The Terra Draw implementation of `DrawingTool`, on a MapLibre map. It draws, edits and reports; it never judges a shape (the domain's
 * `validateGeometry` does, in the form). One exception on purpose: a polygon that crosses itself is refused while it is being drawn,
 * so the mistake is caught where it is made.
 */
export class MapLibreAreaTool implements DrawingTool {
  private readonly map: ML.Map;
  private readonly draw: TerraDraw;
  private handler: (shape: DrawnShape | null) => void = () => {};
  private quiet = false;

  private constructor(map: ML.Map, draw: TerraDraw) {
    this.map = map;
    this.draw = draw;
  }

  static async create(container: HTMLElement, options: DrawingToolOptions, basemap: BasemapSource): Promise<MapLibreAreaTool> {
    // The drawing library is only fetched when someone draws: a read-only map never downloads it.
    const [{ TerraDraw, TerraDrawLineStringMode, TerraDrawPolygonMode, TerraDrawRenderMode, TerraDrawSelectMode, ValidateNotSelfIntersecting }, { TerraDrawMapLibreGLAdapter }] = await Promise.all([import("terra-draw"), import("terra-draw-maplibre-gl-adapter")]);
    const { map } = await openMap(container, { basemap: options.basemap, focus: options.focus, outline: options.outline, guide: options.guide, lang: options.lang }, basemap);
    await new Promise<void>((resolve) => { if (map.isStyleLoaded()) resolve(); else map.once("load", () => resolve()); });
    const styles = { fillColor: SHAPE_COLOR, fillOpacity: 0.25, outlineColor: SHAPE_COLOR, outlineWidth: 3 } as const;
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode({ styles: { fillColor: SHAPE_COLOR, fillOpacity: 0.25, outlineColor: SHAPE_COLOR, outlineWidth: 3 }, validation: (feature) => ValidateNotSelfIntersecting(feature) }),
        new TerraDrawLineStringMode({ styles: { lineStringColor: SHAPE_COLOR, lineStringWidth: 4 } }),
        new TerraDrawSelectMode({ flags: { polygon: EDITABLE, linestring: EDITABLE } }),
        new TerraDrawRenderMode({ modeName: "static", styles: { polygonFillColor: styles.fillColor, polygonFillOpacity: styles.fillOpacity, polygonOutlineColor: styles.outlineColor, polygonOutlineWidth: styles.outlineWidth, lineStringColor: SHAPE_COLOR, lineStringWidth: 4 } }),
      ],
    });
    const tool = new MapLibreAreaTool(map, draw);
    draw.start();
    draw.setMode("static");
    // A shape just drawn ends drawing (so the next click does not start another); an edit keeps the select mode.
    draw.on("finish", (_id, context) => { tool.report(); if (context.action === "draw") draw.setMode("static"); });
    draw.on("change", (_ids, type) => { if (type === "delete") tool.report(); });
    return tool;
  }

  load(shape: DrawnShape | null): void {
    this.replaceAll(shape ? [{ type: "Feature", properties: { mode: shape.type === "Polygon" ? "polygon" : "linestring" }, geometry: shape as never } as GeoJSONStoreFeatures] : []);
    this.draw.setMode("static");
  }

  start(kind: DrawKind): void {
    this.replaceAll([]);
    this.draw.setMode(kind === "OUTLINE" ? "polygon" : "linestring");
    this.handler(null); // a shape is being replaced: the form must not keep the old one
  }

  edit(): void {
    const feature = this.current();
    if (!feature) return;
    this.draw.setMode("select");
    this.draw.selectFeature(feature.id as string);
  }

  stop(): void { this.draw.setMode("static"); }

  remove(): void {
    this.replaceAll([]);
    this.draw.setMode("static");
    this.handler(null);
  }

  onChange(handler: (shape: DrawnShape | null) => void): void { this.handler = handler; }

  dispose(): void {
    this.quiet = true;
    try { this.draw.stop(); } catch { /* already stopped */ }
    this.map.remove();
  }

  // ---- internals ---------------------------------------------------------------------------------------

  private current(): GeoJSONStoreFeatures | undefined {
    return this.draw.getSnapshot().find((f) => isShape(f.geometry as { type: string }) && (f.properties as { selectionPoint?: boolean; midPoint?: boolean }).selectionPoint !== true && (f.properties as { midPoint?: boolean }).midPoint !== true);
  }

  /** Keeps exactly one shape, the newest, and tells the form. */
  private report(): void {
    if (this.quiet) return;
    const shapes = this.draw.getSnapshot().filter((f) => isShape(f.geometry as { type: string }) && (f.properties as { selectionPoint?: boolean }).selectionPoint !== true && (f.properties as { midPoint?: boolean }).midPoint !== true);
    const keep = shapes[shapes.length - 1];
    const extra = shapes.slice(0, -1).map((f) => f.id as string);
    if (extra.length) this.draw.removeFeatures(extra);
    this.handler(keep ? ({ type: (keep.geometry as { type: "Polygon" | "LineString" }).type, coordinates: (keep.geometry as { coordinates: unknown }).coordinates }) : null);
  }

  /** Leaves edit mode first: while a shape is selected Terra Draw also holds handle points, which it removes itself and which fail if removed twice. */
  private replaceAll(features: GeoJSONStoreFeatures[]): void {
    this.draw.setMode("static");
    const ids = this.draw.getSnapshot().map((f) => f.id as string);
    if (ids.length) this.draw.removeFeatures(ids);
    if (features.length) this.draw.addFeatures(features);
  }
}
