/**
 * Map outlines for an infographic (Phase 32.5): the project country's outline and its first-level
 * areas, taken from the boundaries bundled with the app and simplified so a request stays small.
 * Pure: the geo collections are passed in, so the same function is tested without the data files.
 *
 * Nothing here is authoritative cartography. The export carries the UN map disclaimer beside every
 * map, and an organization's own uploaded boundary layer is the way to show approved borders.
 */
import type { NamedGeoCollection, NamedGeoFeature } from "../../workplan/domain/geo/geo-types.ts";
import { normalizePlace, provincesOf } from "../../workplan/domain/site-map.ts";

export type Ring = Array<[number, number]>;

export interface MapShape {
  kind: "COUNTRY" | "REGION";
  name?: string;
  value?: number;
  rings: Ring[];
}

const MAX_POINTS_PER_COUNTRY_RING = 360;
const MAX_POINTS_PER_REGION_RING = 90;
const MAX_REGIONS = 100;
const MAX_TOTAL_POINTS = 40_000;

/** The outer ring of every polygon in a (Multi)Polygon geometry. */
export function outerRingsOf(geometry: unknown): Ring[] {
  if (!geometry || typeof geometry !== "object") return [];
  const g = geometry as { type?: string; coordinates?: unknown };
  const toRing = (value: unknown): Ring | null => {
    if (!Array.isArray(value)) return null;
    const ring: Ring = [];
    for (const point of value) {
      if (Array.isArray(point) && typeof point[0] === "number" && typeof point[1] === "number") ring.push([point[0], point[1]]);
    }
    return ring.length >= 3 ? ring : null;
  };
  if (g.type === "Polygon" && Array.isArray(g.coordinates)) {
    const ring = toRing(g.coordinates[0]);
    return ring ? [ring] : [];
  }
  if (g.type === "MultiPolygon" && Array.isArray(g.coordinates)) {
    const out: Ring[] = [];
    for (const polygon of g.coordinates) {
      if (!Array.isArray(polygon)) continue;
      const ring = toRing(polygon[0]);
      if (ring) out.push(ring);
    }
    return out;
  }
  return [];
}

const triangleArea = (a: [number, number], b: [number, number], c: [number, number]): number => Math.abs((a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])) / 2);

/** Visvalingam–Whyatt: repeatedly removes the point whose removal changes the shape least, until `maxPoints` remain. */
export function simplifyRing(ring: Ring, maxPoints: number): Ring {
  const closed = ring.length > 1 && ring[0]![0] === ring[ring.length - 1]![0] && ring[0]![1] === ring[ring.length - 1]![1];
  let points = closed ? ring.slice(0, -1) : ring.slice();
  if (points.length <= maxPoints) return points;
  // Thin very dense rings first so the quadratic pass below stays cheap.
  if (points.length > 2000) {
    const stride = Math.ceil(points.length / 2000);
    points = points.filter((_, i) => i % stride === 0);
  }
  const keep = Math.max(3, maxPoints);
  while (points.length > keep) {
    let smallest = Infinity;
    let at = 1;
    for (let i = 0; i < points.length; i += 1) {
      const area = triangleArea(points[(i + points.length - 1) % points.length]!, points[i]!, points[(i + 1) % points.length]!);
      if (area < smallest) {
        smallest = area;
        at = i;
      }
    }
    points.splice(at, 1);
  }
  return points;
}

const round = (n: number): number => Math.round(n * 1000) / 1000;
const roundRing = (ring: Ring): Ring => ring.map(([x, y]) => [round(x), round(y)] as [number, number]);

const area = (ring: Ring): number => {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2);
};

const featureOf = (world: NamedGeoCollection, country: string): NamedGeoFeature | undefined => {
  const wanted = normalizePlace(country);
  if (!wanted) return undefined;
  return world.features.find((f) => normalizePlace(f.properties.name) === wanted || normalizePlace(f.properties.country ?? "") === wanted);
};

/**
 * The country outline plus (optionally) its first-level areas, each carrying a value when the caller has one.
 * `valueByLocation` is keyed by the normalised location name, the same key the rest of the product uses.
 * Areas with no value are drawn unshaded: a missing figure is never shaded as zero.
 */
export function buildMapShapes(input: { country: string; world: NamedGeoCollection; admin1?: NamedGeoCollection; valueByLocation?: Readonly<Record<string, number>>; withRegions: boolean }): MapShape[] {
  const feature = featureOf(input.world, input.country);
  if (!feature) return [];
  const shapes: MapShape[] = [];
  let total = 0;
  const countryRings = outerRingsOf(feature.geometry);
  const largest = Math.max(0, ...countryRings.map(area));
  const kept = countryRings.filter((ring) => area(ring) >= largest * 0.02).sort((a, b) => area(b) - area(a)).slice(0, 12);
  const simplified = kept.map((ring) => roundRing(simplifyRing(ring, MAX_POINTS_PER_COUNTRY_RING)));
  total += simplified.reduce((n, ring) => n + ring.length, 0);
  if (simplified.length > 0) shapes.push({ kind: "COUNTRY", name: feature.properties.name, rings: simplified });
  if (input.withRegions && input.admin1) {
    const regions = provincesOf(input.admin1, input.country);
    for (const region of (regions?.features ?? []).slice(0, MAX_REGIONS)) {
      const rings = outerRingsOf(region.geometry)
        .sort((a, b) => area(b) - area(a))
        .slice(0, 6)
        .map((ring) => roundRing(simplifyRing(ring, MAX_POINTS_PER_REGION_RING)));
      const points = rings.reduce((n, ring) => n + ring.length, 0);
      if (rings.length === 0 || total + points > MAX_TOTAL_POINTS) continue;
      total += points;
      const value = input.valueByLocation?.[normalizePlace(region.properties.name)];
      shapes.push({ kind: "REGION", name: region.properties.name, ...(typeof value === "number" ? { value } : {}), rings });
    }
  }
  return shapes;
}

/** Counts of points in a request, for the schema's bound (60,000). */
export const shapePointCount = (shapes: readonly MapShape[]): number => shapes.reduce((n, shape) => n + shape.rings.reduce((m, ring) => m + ring.length, 0), 0);
