/**
 * Map overlays (Phase 35, after DevResults' "Map Overlays"): context drawn on a map -- rivers, roads, a conservation area, a camp outline -- kept by the
 * organisation and ticked on per map. Nothing is reported against an overlay and it never replaces a boundary. A file is converted to GeoJSON before it gets here;
 * this checks the GeoJSON and keeps only what can be drawn. Pure.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";

export const MAP_OVERLAY_MAX_BYTES = 5_000_000;
export const MAP_OVERLAY_MAX_FEATURES = 5000;
export const MAP_OVERLAYS_PER_ORGANISATION = 20;
const NAME_MAX = 80;

export interface ValidatedOverlay { json: string; featureCount: number; name: string }

const isPair = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length >= 2 && typeof v[0] === "number" && typeof v[1] === "number" && Number.isFinite(v[0]) && Number.isFinite(v[1]) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90;

/** Every coordinate pair of a geometry is in range; a point/line/polygon with a bad pair is dropped, never bent. */
function geometryOk(g: { type?: unknown; coordinates?: unknown }): boolean {
  const c = g.coordinates;
  if (!Array.isArray(c)) return false;
  switch (g.type) {
    case "Point": return isPair(c);
    case "MultiPoint": case "LineString": return c.length > 0 && c.every(isPair);
    case "Polygon": case "MultiLineString": return c.length > 0 && c.every((r) => Array.isArray(r) && r.length > 0 && r.every(isPair));
    case "MultiPolygon": return c.length > 0 && c.every((p) => Array.isArray(p) && p.every((r) => Array.isArray(r) && r.length > 0 && r.every(isPair)));
    default: return false;
  }
}

export function validateOverlay(raw: string, name: string): Result<ValidatedOverlay> {
  const label = name.replace(/\.(geo)?json|\.kml|\.kmz$/i, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  if (!label) return err(DomainError.validation("Give the overlay a name.", { field: "name" }));
  if (!raw || Buffer.byteLength(raw, "utf8") > MAP_OVERLAY_MAX_BYTES) return err(DomainError.validation("That overlay is too large. Simplify it first (the limit is 5 MB once converted).", { field: "file" }));
  let parsed: { type?: unknown; features?: unknown; geometry?: unknown };
  try { parsed = JSON.parse(raw); } catch { return err(DomainError.validation("That overlay could not be read.", { field: "file" })); }
  const features: unknown[] = parsed.type === "FeatureCollection" && Array.isArray(parsed.features) ? parsed.features : parsed.type === "Feature" ? [parsed] : [];
  if (features.length > MAP_OVERLAY_MAX_FEATURES) return err(DomainError.validation(`That overlay has more than ${MAP_OVERLAY_MAX_FEATURES} features. Simplify it first.`, { field: "file" }));
  const kept = features.filter((f) => {
    const g = (f as { geometry?: { type?: unknown; coordinates?: unknown } | null } | null)?.geometry;
    return !!g && typeof g === "object" && geometryOk(g);
  }).map((f) => {
    const feature = f as { properties?: Record<string, unknown> | null; geometry: unknown };
    const n = feature.properties?.name ?? feature.properties?.Name;
    return { type: "Feature", properties: typeof n === "string" && n ? { name: n.slice(0, 120) } : {}, geometry: feature.geometry };
  });
  if (kept.length === 0) return err(DomainError.validation("That overlay has nothing to draw: no points, lines or areas inside the map's range (longitude -180 to 180, latitude -90 to 90).", { field: "file" }));
  return ok({ json: JSON.stringify({ type: "FeatureCollection", features: kept }), featureCount: kept.length, name: label });
}
