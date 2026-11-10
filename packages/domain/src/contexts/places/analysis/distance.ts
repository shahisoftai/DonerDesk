/**
 * Straight-line distances and rings (Phase 49.7). Pure, on a sphere of the Earth's mean radius: accurate to well under 1% at the distances
 * a project works at. A distance is always "straight line", never travel time: there is no road network here.
 */
export const EARTH_KM = 6371.0088;
export const MAX_RING_KM = 100;
export const MIN_RING_KM = 0.1;

export interface LngLat { lng: number; lat: number }

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

export function distanceKm(a: LngLat, b: LngLat): number {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type RingProblem = "RADIUS_OUT_OF_RANGE" | "NEAR_POLE" | "BAD_POINT";

/** One check for a ring: 0.1 to 100 km, a real point, not within the ring's radius of a pole (where a circle stops being one). */
export function ringProblem(centre: LngLat, km: number): RingProblem | null {
  if (!Number.isFinite(centre.lat) || !Number.isFinite(centre.lng) || Math.abs(centre.lat) > 90 || Math.abs(centre.lng) > 180) return "BAD_POINT";
  if (!Number.isFinite(km) || km < MIN_RING_KM || km > MAX_RING_KM) return "RADIUS_OUT_OF_RANGE";
  if (90 - Math.abs(centre.lat) < deg(km / EARTH_KM) + 0.5) return "NEAR_POLE";
  return null;
}

/**
 * The ring as a closed polygon (`steps` points on the circle), longitudes unwrapped so a ring across the antimeridian stays one shape
 * (a renderer draws it across the line). GeoJSON order: [lng, lat].
 */
export function ringPolygon(centre: LngLat, km: number, steps = 64): Array<[number, number]> {
  const d = km / EARTH_KM, lat1 = rad(centre.lat), lng1 = rad(centre.lng);
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * (i % steps)) / steps;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
    const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    out.push([Math.round(deg(lng2) * 1e6) / 1e6, Math.round(deg(lat2) * 1e6) / 1e6]);
  }
  return out;
}

/** The ring's bounding box (west, south, east, north), unwrapped like the polygon. */
export function ringBox(centre: LngLat, km: number): [number, number, number, number] {
  const dLat = deg(km / EARTH_KM);
  const dLng = deg(km / (EARTH_KM * Math.cos(rad(centre.lat))));
  return [centre.lng - dLng, centre.lat - dLat, centre.lng + dLng, centre.lat + dLat];
}
