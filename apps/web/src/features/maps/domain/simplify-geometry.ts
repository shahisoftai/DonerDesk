/**
 * Douglas-Peucker simplification of GeoJSON polygons, so full-resolution boundary files fit a district map.
 * Pure. A ring never drops below four points (a closed triangle), and a ring that collapses is removed.
 */
type Pt = readonly [number, number];

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Iterative (a ring may have 100k vertices; recursion would overflow the stack). */
export function simplifyLine(points: readonly Pt[], epsilon: number): Pt[] {
  if (points.length <= 2) return [...points];
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    let max = 0, at = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = distToSegment(points[i]!, points[lo]!, points[hi]!);
      if (d > max) { max = d; at = i; }
    }
    if (at >= 0 && max > epsilon) { keep[at] = true; stack.push([lo, at], [at, hi]); }
  }
  return points.filter((_, i) => keep[i]);
}

function simplifyRing(ring: readonly Pt[], epsilon: number): Pt[] | null {
  const out = simplifyLine(ring, epsilon);
  return out.length >= 4 ? out : null;
}

export function simplifyGeometry(geometry: unknown, epsilon: number): unknown {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g || !Array.isArray(g.coordinates)) return geometry;
  const polygon = (rings: Pt[][]): Pt[][] | null => {
    const out = rings.map((r) => simplifyRing(r, epsilon));
    return out[0] ? (out.filter((r): r is Pt[] => r !== null)) : null;
  };
  if (g.type === "Polygon") {
    const p = polygon(g.coordinates as Pt[][]);
    return p ? { ...g, coordinates: p } : null;
  }
  if (g.type === "MultiPolygon") {
    const parts = (g.coordinates as Pt[][][]).map(polygon).filter((p): p is Pt[][] => p !== null);
    return parts.length ? { ...g, coordinates: parts } : null;
  }
  return geometry;
}
