/**
 * A GeoJSON file drawn on the map as an extra layer for this visit (nothing is stored). Pure: text in, a validated overlay out,
 * then the ECharts series for it. Limits are checked here so a huge or odd file is refused in a sentence, never drawn half-way.
 */
export const OVERLAY_MAX_BYTES = 5_000_000;
export const OVERLAY_MAX_FEATURES = 5000;

export interface Overlay {
  name: string;
  points: Array<{ name: string; lng: number; lat: number }>;
  /** Polygon rings and line strings, each a list of [lng, lat]. */
  lines: Array<{ name: string; coords: Array<[number, number]> }>;
}

export type OverlayResult = { ok: true; overlay: Overlay } | { ok: false; reason: string };

const isPair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length >= 2 && typeof v[0] === "number" && typeof v[1] === "number" && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90;

export function parseOverlay(text: string, name: string): OverlayResult {
  if (text.length > OVERLAY_MAX_BYTES) return { ok: false, reason: "That file is larger than 5 MB. Simplify it first." };
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { ok: false, reason: "That file is not valid GeoJSON (it could not be read)." }; }
  const root = json as { type?: string; features?: unknown[]; geometry?: unknown };
  const features: unknown[] = root.type === "FeatureCollection" && Array.isArray(root.features) ? root.features : root.type === "Feature" ? [root] : [];
  if (features.length === 0) return { ok: false, reason: "That file has no features to draw." };
  if (features.length > OVERLAY_MAX_FEATURES) return { ok: false, reason: `That file has more than ${OVERLAY_MAX_FEATURES} features. Simplify it first.` };
  const overlay: Overlay = { name, points: [], lines: [] };
  for (const f of features) {
    const feature = f as { properties?: Record<string, unknown> | null; geometry?: { type?: string; coordinates?: unknown } | null };
    const label = String(feature.properties?.name ?? feature.properties?.Name ?? "");
    const g = feature.geometry;
    if (!g || !Array.isArray(g.coordinates)) continue;
    const c = g.coordinates as unknown[];
    const addLine = (coords: unknown[]) => { if (coords.every(isPair)) overlay.lines.push({ name: label, coords: coords as Array<[number, number]> }); };
    if (g.type === "Point") {
      if (isPair(c)) overlay.points.push({ name: label, lng: c[0], lat: c[1] });
    } else if (g.type === "MultiPoint") {
      for (const p of c) if (isPair(p)) overlay.points.push({ name: label, lng: p[0], lat: p[1] });
    } else if (g.type === "LineString") {
      addLine(c);
    } else if (g.type === "MultiLineString" || g.type === "Polygon") {
      for (const part of c as unknown[][]) addLine(part);
    } else if (g.type === "MultiPolygon") {
      for (const poly of c as unknown[][][]) for (const ring of poly) addLine(ring);
    }
  }
  if (overlay.points.length === 0 && overlay.lines.length === 0) return { ok: false, reason: "That file has no points, lines or areas inside the map's range (longitude -180 to 180, latitude -90 to 90)." };
  return { ok: true, overlay };
}

export function overlaySeries(overlay: Overlay, opacity: number): Array<Record<string, unknown>> {
  const series: Array<Record<string, unknown>> = [];
  if (overlay.lines.length > 0) {
    series.push({ type: "lines", coordinateSystem: "geo", polyline: true, silent: true, lineStyle: { color: "#7c3aed", width: 1.5, opacity }, data: overlay.lines.map((l) => ({ coords: l.coords })) });
  }
  if (overlay.points.length > 0) {
    series.push({ type: "scatter", coordinateSystem: "geo", symbolSize: 7, itemStyle: { color: "#7c3aed", opacity }, data: overlay.points.map((p) => ({ name: p.name || overlay.name, value: [p.lng, p.lat] })) });
  }
  return series;
}
