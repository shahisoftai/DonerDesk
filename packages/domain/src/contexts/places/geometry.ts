/**
 * The shape of a place that is an area or a route (Phase 41.6). Pure: no clock, no I/O.
 *
 * A pin is a point (latitude and longitude on the place). A drawn shape is an outline (a camp, a catchment) or a line (a distribution
 * route), kept as GeoJSON in storage, never in the row. This is the one check for both: the server runs it on every write and the
 * browser runs the same function before it offers Save, so a shape that looks fine on screen is never refused later for a reason
 * the screen could have said.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";

export type GeometryKind = "POLYGON" | "LINE";
export type Position = [number, number];
export type PlaceGeometry =
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "LineString"; coordinates: Position[] };

export const GEOMETRY_MAX_VERTICES = 2000;
export const GEOMETRY_MAX_BYTES = 1_000_000;
/** Six decimals is about 10 cm: far finer than a drawn outline, and small in the file. */
export const GEOMETRY_DIGITS = 6;

/** How a place's location came to be. Recorded for the audit trail and to judge how exact it is. */
export const PLACED_BY = ["TYPED", "MAP_PIN", "MAP_DRAWN", "SNAPPED", "IMPORT", "GPS"] as const;
export type PlacedBy = (typeof PLACED_BY)[number];
export const isPlacedBy = (value: unknown): value is PlacedBy => typeof value === "string" && (PLACED_BY as readonly string[]).includes(value);

export interface CheckedGeometry {
  geometry: PlaceGeometry;
  kind: GeometryKind;
  vertices: number;
  bytes: number;
  /** The exact text to store. */
  json: string;
}

/** Why a shape was refused, as a code a screen can translate (the English sentence stays for the server and the API). */
export const GEOMETRY_PROBLEMS = ["MISSING", "WRONG_TYPE", "NO_COORDINATES", "HOLES", "TOO_FEW_CORNERS", "NOT_CLOSED", "TOO_FEW_DISTINCT_CORNERS", "NO_AREA", "SELF_CROSSING", "ROUTE_TOO_SHORT", "OUT_OF_RANGE", "TOO_MANY_POINTS", "TOO_LARGE"] as const;
export type GeometryProblem = (typeof GEOMETRY_PROBLEMS)[number];
const bad = (message: string, code: GeometryProblem, params: Record<string, string | number> = {}) => err(DomainError.validation(message, { field: "geometry", code, params }));
const round = (n: number): number => { const f = 10 ** GEOMETRY_DIGITS; return Math.round(n * f) / f; };

function readPosition(value: unknown): Position | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const [x, y] = value;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [round(x), round(y)];
}

const cross = (o: Position, a: Position, b: Position): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const onSegment = (a: Position, b: Position, p: Position): boolean => Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);

/** True when the two segments share any point (a touch at an end counts). */
export function segmentsMeet(a: Position, b: Position, c: Position, d: Position): boolean {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return (d1 === 0 && onSegment(c, d, a)) || (d2 === 0 && onSegment(c, d, b)) || (d3 === 0 && onSegment(a, b, c)) || (d4 === 0 && onSegment(a, b, d));
}

/** Two edges that share a corner fold back over each other when they run the same way from it. */
const foldsBack = (corner: Position, a: Position, b: Position): boolean =>
  cross(corner, a, b) === 0 && (a[0] - corner[0]) * (b[0] - corner[0]) + (a[1] - corner[1]) * (b[1] - corner[1]) > 0;

/** The first pair of edges of a closed ring that cross or overlap (edges that only share a corner are neighbours, not a crossing). */
export function ringCrossing(ring: readonly Position[]): [number, number] | null {
  const edges = ring.length - 1;
  for (let i = 0; i < edges; i += 1) {
    for (let j = i + 1; j < edges; j += 1) {
      if (j === i + 1) { if (foldsBack(ring[i + 1]!, ring[i]!, ring[j + 1]!)) return [i, j]; continue; }
      if (i === 0 && j === edges - 1) { if (foldsBack(ring[0]!, ring[1]!, ring[edges - 1]!)) return [i, j]; continue; }
      if (segmentsMeet(ring[i]!, ring[i + 1]!, ring[j]!, ring[j + 1]!)) return [i, j];
    }
  }
  return null;
}

/** True when every point lies on one straight line, so the "outline" encloses nothing. (A signed area of zero is not the test: a bow-tie has it too.) */
export function allCollinear(points: readonly Position[]): boolean {
  const first = points[0]!;
  const second = points.find((p) => p[0] !== first[0] || p[1] !== first[1]);
  return second === undefined || points.every((p) => cross(first, second, p) === 0);
}

export function validateGeometry(input: unknown): Result<CheckedGeometry, DomainError> {
  const g = input as { type?: unknown; coordinates?: unknown } | null;
  if (!g || typeof g !== "object" || !Array.isArray(g.coordinates)) return bad("Draw an outline or a route on the map", "MISSING");
  let geometry: PlaceGeometry;
  let kind: GeometryKind;
  let vertices: number;

  if (g.type === "Polygon") {
    if (g.coordinates.length !== 1) return bad("An area has one outline, without holes", "HOLES");
    const ring: Position[] = [];
    for (const raw of g.coordinates[0] as unknown[]) {
      const p = readPosition(raw);
      if (!p) return bad("Every point of the outline needs a longitude and a latitude", "NO_COORDINATES");
      ring.push(p);
    }
    if (ring.length < 4) return bad("An outline needs at least three corners", "TOO_FEW_CORNERS");
    const first = ring[0]!, last = ring[ring.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) return bad("The outline must come back to where it started", "NOT_CLOSED");
    vertices = ring.length - 1;
    if (new Set(ring.slice(0, -1).map((p) => `${p[0]},${p[1]}`)).size < 3) return bad("An outline needs at least three different corners", "TOO_FEW_DISTINCT_CORNERS");
    if (allCollinear(ring)) return bad("That outline has no area: its corners are in a straight line", "NO_AREA");
    if (ringCrossing(ring)) return bad("The outline crosses itself; move a corner so the edges do not cross", "SELF_CROSSING");
    geometry = { type: "Polygon", coordinates: [ring] };
    kind = "POLYGON";
  } else if (g.type === "LineString") {
    const line: Position[] = [];
    for (const raw of g.coordinates as unknown[]) {
      const p = readPosition(raw);
      if (!p) return bad("Every point of the route needs a longitude and a latitude", "NO_COORDINATES");
      line.push(p);
    }
    const distinct = new Set(line.map((p) => `${p[0]},${p[1]}`)).size;
    if (line.length < 2 || distinct < 2) return bad("A route needs at least two different points", "ROUTE_TOO_SHORT");
    vertices = line.length;
    geometry = { type: "LineString", coordinates: line };
    kind = "LINE";
  } else {
    return bad("Only an outline (polygon) or a route (line) can be drawn", "WRONG_TYPE");
  }

  const every = geometry.type === "Polygon" ? geometry.coordinates[0]! : geometry.coordinates;
  if (every.some(([x, y]) => x < -180 || x > 180 || y < -90 || y > 90)) return bad("That shape is outside the map (longitude -180 to 180, latitude -90 to 90)", "OUT_OF_RANGE");
  if (vertices > GEOMETRY_MAX_VERTICES) return bad(`A shape has at most ${GEOMETRY_MAX_VERTICES} points; simplify it`, "TOO_MANY_POINTS", { max: GEOMETRY_MAX_VERTICES });
  const json = JSON.stringify({ type: "Feature", properties: {}, geometry });
  const bytes = new TextEncoder().encode(json).length;
  if (bytes > GEOMETRY_MAX_BYTES) return bad("That shape is too large to store; simplify it", "TOO_LARGE");
  return ok({ geometry, kind, vertices, bytes, json });
}
