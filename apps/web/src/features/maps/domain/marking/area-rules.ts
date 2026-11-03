/**
 * What the screen says about a drawn shape before it is saved. Pure.
 * The shape is checked by the domain's `validateGeometry` (the same function the server runs, so Save is never refused for a reason the
 * screen could have said). A shape that strays outside its parent is only a warning: boundary files are simplified, so a drawn camp at the
 * edge of a district is not wrong.
 */
import { validateGeometry } from "@donordesk/domain/contexts/places/geometry.js";
import { geometryContains } from "../point-in-area.ts";

export interface DrawnShape { type: "Polygon" | "LineString"; coordinates: unknown }

/**
 * What is wrong with a shape (or right), as codes and numbers: the screen says it in the person's language. `message` is the domain's own
 * English sentence, kept for a log or a message nobody has translated yet.
 */
export type ShapeVerdict =
  | { ok: true; kind: "POLYGON" | "LINE"; vertices: number; outside: { name: string; count: number } | null }
  | { ok: false; code: string; params: Record<string, string | number>; message: string };

function vertices(shape: DrawnShape): Array<[number, number]> {
  const flat: Array<[number, number]> = [];
  const walk = (v: unknown): void => {
    if (!Array.isArray(v)) return;
    if (v.length >= 2 && typeof v[0] === "number" && typeof v[1] === "number") { flat.push([v[0], v[1]]); return; }
    for (const part of v) walk(part);
  };
  walk(shape.coordinates);
  return flat;
}

/** How many of the shape's corners lie outside `parent` (a GeoJSON polygon); zero when there is no parent to compare with. */
export function cornersOutside(shape: DrawnShape, parent: unknown | null): number {
  if (!parent) return 0;
  return vertices(shape).filter(([lng, lat]) => !geometryContains(parent, lat, lng)).length;
}

export function judgeShape(shape: DrawnShape | null, parent: { name: string; geometry: unknown } | null = null): ShapeVerdict | null {
  if (!shape) return null;
  const checked = validateGeometry(shape);
  if (!checked.ok) {
    const details = checked.error.details as { code?: string; params?: Record<string, string | number> } | undefined;
    return { ok: false, code: details?.code ?? "UNKNOWN", params: details?.params ?? {}, message: checked.error.message };
  }
  const count = parent ? cornersOutside(shape, parent.geometry) : 0;
  return { ok: true, kind: checked.value.kind, vertices: checked.value.vertices, outside: parent && count > 0 ? { name: parent.name, count } : null };
}
