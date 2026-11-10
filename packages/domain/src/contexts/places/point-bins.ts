/**
 * Many points as counts per grid cell (Phase 49.4). Pure. Above `BIN_ABOVE` points a browser is sent cells, not points: a count and the cell's
 * centre of mass, never a name, until the view is close enough (`zoom >= NAMES_FROM_ZOOM`) to send the points themselves.
 * Cells are square in degrees and halve with every zoom step, so the same points give the same cells for the same view (deterministic).
 */
export const BIN_ABOVE = 5000;
export const NAMES_FROM_ZOOM = 11;

export type BBox = readonly [west: number, south: number, east: number, north: number];
export interface BinPoint { lng: number; lat: number; /** Higher = worse (a delivery state's rank); a cell keeps its worst. */ rank?: number }
export interface PointCell { lng: number; lat: number; count: number; worst: number }
export interface BinnedPoints {
  mode: "CELLS" | "POINTS";
  cells: PointCell[];
  /** Points inside the view (all of them when mode is POINTS). */
  inView: number;
  /** Points outside the view: counted so a total never looks smaller than it is. */
  outside: number;
  cellDegrees: number;
}

/** About 64 pixels of a 512-pixel tile at this zoom, in degrees of longitude. */
export const cellDegreesFor = (zoom: number): number => 360 / 2 ** Math.max(0, Math.min(22, Math.floor(zoom))) / 8;

export function validBBox(b: readonly number[]): b is BBox {
  return b.length === 4 && b.every(Number.isFinite) && b[0]! >= -180 && b[2]! <= 180 && b[1]! >= -90 && b[3]! <= 90 && b[0]! < b[2]! && b[1]! < b[3]!;
}

export function binPoints(points: readonly BinPoint[], bbox: BBox, zoom: number, above = BIN_ABOVE): BinnedPoints {
  const inside = points.filter((p) => p.lng >= bbox[0] && p.lng <= bbox[2] && p.lat >= bbox[1] && p.lat <= bbox[3]);
  const outside = points.length - inside.length;
  const cellDegrees = cellDegreesFor(zoom);
  if (inside.length <= above || zoom >= NAMES_FROM_ZOOM) return { mode: "POINTS", cells: [], inView: inside.length, outside, cellDegrees };
  const cells = new Map<string, { sx: number; sy: number; count: number; worst: number }>();
  for (const p of inside) {
    const key = `${Math.floor(p.lng / cellDegrees)}:${Math.floor(p.lat / cellDegrees)}`;
    const c = cells.get(key) ?? { sx: 0, sy: 0, count: 0, worst: 0 };
    c.sx += p.lng; c.sy += p.lat; c.count += 1; c.worst = Math.max(c.worst, p.rank ?? 0);
    cells.set(key, c);
  }
  const round = (n: number): number => Math.round(n * 1e5) / 1e5;
  const out = [...cells.values()].map((c) => ({ lng: round(c.sx / c.count), lat: round(c.sy / c.count), count: c.count, worst: c.worst }))
    .sort((a, b) => a.lat - b.lat || a.lng - b.lng);
  return { mode: "CELLS", cells: out, inView: inside.length, outside, cellDegrees };
}
