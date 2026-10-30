/**
 * Which boundary a pin falls inside. Pure: a GeoJSON collection and a point in, the containing feature's name out.
 * Used to suggest where a new place sits in the hierarchy; it only suggests, a person confirms.
 */
type Ring = ReadonlyArray<readonly [number, number]>;

function inRing(ring: Ring, lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A polygon is its outer ring minus its holes. */
function inPolygon(rings: ReadonlyArray<Ring>, lng: number, lat: number): boolean {
  if (rings.length === 0 || !inRing(rings[0]!, lng, lat)) return false;
  return !rings.slice(1).some((hole) => inRing(hole, lng, lat));
}

export function geometryContains(geometry: unknown, lat: number, lng: number): boolean {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g || !Array.isArray(g.coordinates)) return false;
  if (g.type === "Polygon") return inPolygon(g.coordinates as Ring[], lng, lat);
  if (g.type === "MultiPolygon") return (g.coordinates as Ring[][]).some((p) => inPolygon(p, lng, lat));
  return false;
}

export interface AreaFeature { properties: { name: string }; geometry: unknown }

/** The first feature containing the point, or null (the point is outside every area, or the coordinates are not valid). */
export function containingFeature(features: readonly AreaFeature[], lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return features.find((f) => geometryContains(f.geometry, lat, lng))?.properties.name ?? null;
}
