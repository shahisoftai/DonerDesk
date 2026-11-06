/**
 * The units of a finer level that sit inside a parent boundary. Pure.
 * By parent P-code when the file carries it (COD-AB does); otherwise by position: a unit belongs to the parent if its
 * centre, or its first vertex, lies inside the parent's outline. Position is a close call at the edge, so a unit is
 * never dropped for being on a border: either test passing keeps it.
 */
import { geometryContains } from "../point-in-area.ts";
import { geometryBounds } from "../model/bounds.ts";
import type { BoundaryUnit } from "./join.ts";

export type WithinBasis = "PARENT_CODE" | "POSITION";

function firstVertex(geometry: unknown): [number, number] | null {
  let v: unknown = (geometry as { coordinates?: unknown } | null)?.coordinates;
  while (Array.isArray(v) && Array.isArray(v[0])) v = v[0];
  return Array.isArray(v) && typeof v[0] === "number" && typeof v[1] === "number" ? [v[0], v[1]] : null;
}

export function unitsWithin(units: readonly BoundaryUnit[], parent: BoundaryUnit): { units: BoundaryUnit[]; basis: WithinBasis } {
  if (parent.pcode && units.some((u) => u.parentPcode)) {
    return { units: units.filter((u) => u.parentPcode === parent.pcode), basis: "PARENT_CODE" };
  }
  const kept = units.filter((u) => {
    const box = geometryBounds(u.geometry);
    const centre: [number, number] | null = box ? [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] : null;
    const vertex = firstVertex(u.geometry);
    return (centre !== null && geometryContains(parent.geometry, centre[1], centre[0])) || (vertex !== null && geometryContains(parent.geometry, vertex[1], vertex[0]));
  });
  return { units: kept, basis: "POSITION" };
}
