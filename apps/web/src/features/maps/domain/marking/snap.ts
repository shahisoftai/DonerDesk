/**
 * Which areas a pin falls inside, and which listed place that suggests as its parent. Pure.
 * Both only SUGGEST: a parent the person already chose is never replaced, and nothing is written from here.
 */
import { normalizeLocationKey } from "@donordesk/domain/contexts/workplan/index.js";
import type { BoundaryUnit } from "../boundaries/join.ts";
import { geometryContains } from "../point-in-area.ts";
import type { Pin } from "./pin.ts";

export interface ContainingArea { level: number; name: string; pcode: string }

/** The unit of each level that holds the pin, shallowest first. A level with no unit around the pin is left out, never filled in. */
export function containingAreas(pin: Pin, layers: ReadonlyArray<{ level: number; units: readonly BoundaryUnit[] }>): ContainingArea[] {
  const out: ContainingArea[] = [];
  for (const layer of [...layers].sort((a, b) => a.level - b.level)) {
    const hit = layer.units.find((u) => geometryContains(u.geometry, pin.latitude, pin.longitude));
    if (hit) out.push({ level: layer.level, name: hit.name, pcode: hit.pcode });
  }
  return out;
}

export interface ListedPlace { id: string; name: string; code?: string | undefined; adminLevel: number; archived?: boolean | undefined }

/**
 * The deepest containing area that is also a listed place (by P-code, else by name at the same level): the place the new one would
 * sit under. Null when the person has already chosen a parent, or no containing area is listed.
 */
export function suggestParent(areas: readonly ContainingArea[], places: readonly ListedPlace[], chosenParentId: string | null | undefined): ListedPlace | null {
  if (chosenParentId) return null;
  const live = places.filter((p) => !p.archived);
  for (const area of [...areas].reverse()) {
    const byCode = area.pcode ? live.filter((p) => (p.code ?? "").trim().toUpperCase() === area.pcode.toUpperCase()) : [];
    if (byCode.length === 1) return byCode[0]!;
    const byName = live.filter((p) => p.adminLevel === area.level && normalizeLocationKey(p.name) === normalizeLocationKey(area.name));
    if (byName.length === 1) return byName[0]!;
  }
  return null;
}

/** "Inside Nakasongola (district) › Nakaseke (county)": one line for the form. */
export function describeAreas(areas: readonly ContainingArea[], singular: (level: number) => string): string {
  const named = areas.filter((a) => a.level > 0);
  return named.length === 0 ? "" : named.map((a) => `${a.name} (${singular(a.level)})`).join(" › ");
}
