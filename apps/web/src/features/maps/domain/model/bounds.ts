import type { Bounds } from "./scene.ts";

/** The box around any GeoJSON geometry (Polygon, MultiPolygon, LineString, Point...). Null when it holds no coordinate. */
export function geometryBounds(geometry: unknown): Bounds | null {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const walk = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      const [x, y] = value as [number, number];
      if (x < west) west = x;
      if (x > east) east = x;
      if (y < south) south = y;
      if (y > north) north = y;
      return;
    }
    for (const part of value) walk(part);
  };
  walk((geometry as { coordinates?: unknown } | null)?.coordinates);
  return Number.isFinite(west) ? [west, south, east, north] : null;
}

export function unionBounds(boxes: ReadonlyArray<Bounds | null>): Bounds | null {
  const real = boxes.filter((b): b is Bounds => b !== null);
  if (real.length === 0) return null;
  return [Math.min(...real.map((b) => b[0])), Math.min(...real.map((b) => b[1])), Math.max(...real.map((b) => b[2])), Math.max(...real.map((b) => b[3]))];
}

export const pointBounds = (lng: number, lat: number): Bounds => [lng, lat, lng, lat];
