/**
 * The mask that hides everything but one country (Phase 51): the whole world as one polygon with the country's own areas cut out, drawn over
 * the street map and under the data. It is built from the boundaries the map already loaded (the provinces), so its edge is exactly the edge of
 * the shapes drawn on top. A country with nothing loaded has no mask (the map then shows its ground as it is). Pure.
 */
type Ring = ReadonlyArray<readonly [number, number]>;
type Geometry = { type: string; coordinates: unknown };

const WORLD: Ring = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];

/** The outer rings of a polygon or multipolygon (holes inside an area are not cut: a lake inside a province stays covered by the province). */
export function outerRings(geometry: unknown): Ring[] {
  const g = geometry as Geometry | null;
  if (!g || typeof g !== "object") return [];
  if (g.type === "Polygon") { const c = g.coordinates as Ring[]; return c[0] ? [c[0]] : []; }
  if (g.type === "MultiPolygon") return (g.coordinates as Ring[][]).flatMap((p) => (p[0] ? [p[0]] : []));
  return [];
}

const reversed = (r: Ring): Ring => [...r].reverse();

/** The world with every given area cut out, or null when there is nothing to cut (nothing loaded, or a vector-tile box rather than a real outline). */
export function countryMask(areas: ReadonlyArray<{ geometry: unknown; tile?: unknown }>): { type: "Polygon"; coordinates: Ring[] } | null {
  // A unit drawn from vector tiles carries only its box: cutting a box out of the world would hide the edges of the country. Real outlines only.
  const rings = areas.filter((a) => !a.tile).flatMap((a) => outerRings(a.geometry)).filter((r) => r.length >= 4);
  if (rings.length === 0) return null;
  return { type: "Polygon", coordinates: [WORLD, ...rings.map(reversed)] };
}
