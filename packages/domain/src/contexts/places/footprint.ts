/**
 * A project's footprint (Phase 56): the areas of the organisation's place tree the project works in. It is advisory: work outside it is
 * allowed and shown, never refused. An area with this project's records inside it cannot be unticked (its history would fall outside the
 * project); it can be closed instead, which stops new work there and keeps everything recorded. Pure; no node: imports.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import type { PlaceTree } from "./place-tree.js";
import type { AdminLevel } from "./place.js";

export interface ProjectAreaRecord {
  placeId: string;
  closedAt?: Date | null | undefined;
  closedReason?: string | null | undefined;
}

export const CLOSE_REASON_MAX = 300;

export const isOpenArea = (a: ProjectAreaRecord): boolean => !a.closedAt;

export type FootprintVerdict =
  /** The place is one of the footprint's areas or lies inside one. */
  | { status: "INSIDE"; areaId: string; closed: boolean }
  /** The project has areas and this place is in none of them. */
  | { status: "OUTSIDE" }
  /** The project has chosen no areas yet: nothing to compare with. */
  | { status: "NO_FOOTPRINT" }
  /** The place is not in the tree (deleted or never existed). */
  | { status: "UNKNOWN" };

/** Where a place sits against the footprint. An open area wins over a closed one when the place lies in both. */
export function insideFootprint(placeId: string, areas: readonly ProjectAreaRecord[], tree: PlaceTree): FootprintVerdict {
  if (!tree.get(placeId)) return { status: "UNKNOWN" };
  if (areas.length === 0) return { status: "NO_FOOTPRINT" };
  const hits = areas.filter((a) => tree.isInside(placeId, a.placeId));
  if (hits.length === 0) return { status: "OUTSIDE" };
  const open = hits.find(isOpenArea);
  const hit = open ?? hits[0]!;
  return { status: "INSIDE", areaId: tree.current(hit.placeId) ?? hit.placeId, closed: !open };
}

/** The admin level most of the footprint's areas are at (ties go to the coarser level); null with no areas. */
export function footprintLevel(areas: readonly ProjectAreaRecord[], tree: PlaceTree): AdminLevel | null {
  const counts = new Map<AdminLevel, number>();
  for (const a of areas) {
    const p = tree.get(a.placeId);
    if (p) counts.set(p.adminLevel, (counts.get(p.adminLevel) ?? 0) + 1);
  }
  let best: AdminLevel | null = null;
  for (const [level, n] of [...counts].sort((x, y) => x[0] - y[0])) if (best === null || n > (counts.get(best) ?? 0)) best = level;
  return best;
}

/**
 * The one area that would bring an outside place into the footprint: the place's ancestor at the footprint's usual level (or the place itself
 * when it is coarser). Undefined when the place is already inside, unknown, or its chain has nothing at that level (never invents one).
 */
export function extensionFor(placeId: string, areas: readonly ProjectAreaRecord[], tree: PlaceTree): { placeId: string; name: string; path: string } | undefined {
  const verdict = insideFootprint(placeId, areas, tree);
  if (verdict.status !== "OUTSIDE") return undefined;
  const level = footprintLevel(areas, tree);
  if (level === null) return undefined;
  const chain = tree.chain(placeId);
  const area = chain.find((p) => p.adminLevel === level) ?? (chain[0] && chain[0].adminLevel < level ? chain[0] : undefined);
  return area ? { placeId: area.id, name: area.name, path: tree.path(area.id) } : undefined;
}

/** The places a picker offers for new work: open areas and every live place inside them. Closed areas are left out; their places stay readable. */
export function placesForNewWork(areas: readonly ProjectAreaRecord[], tree: PlaceTree): Set<string> {
  const out = new Set<string>();
  for (const a of areas.filter(isOpenArea)) {
    const id = tree.current(a.placeId);
    if (!id || !tree.isLive(id)) continue;
    out.add(id);
    for (const d of tree.descendants(id)) out.add(d);
  }
  return out;
}

/** How many records of one kind sit in an area (or a place inside it). Read by the untick rule. */
export interface AreaDependents {
  plannedActivities: number;
  activities: number;
  indicatorValues: number;
  evidence: number;
  beneficiaries: number;
}

export const NO_DEPENDENTS: AreaDependents = { plannedActivities: 0, activities: 0, indicatorValues: 0, evidence: 0, beneficiaries: 0 };

const DEPENDENT_WORDS: ReadonlyArray<[keyof AreaDependents, string, string]> = [
  ["plannedActivities", "planned activity", "planned activities"],
  ["activities", "completed activity", "completed activities"],
  ["indicatorValues", "indicator value", "indicator values"],
  ["evidence", "file", "files"],
  ["beneficiaries", "person reached", "people reached"],
];

export function totalDependents(d: AreaDependents): number {
  return DEPENDENT_WORDS.reduce((sum, [key]) => sum + d[key], 0);
}

/** "12 completed activities and 4 indicator values": the dependents read as one phrase (only kinds that have any). */
export function describeDependents(d: AreaDependents): string {
  const parts = DEPENDENT_WORDS.filter(([key]) => d[key] > 0).map(([key, one, many]) => `${d[key]} ${d[key] === 1 ? one : many}`);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/** Untick is refused while the project's own records sit in the area; the message names them and offers closing instead. */
export function checkUntickArea(areaName: string, dependents: AreaDependents): Result<void, DomainError> {
  if (totalDependents(dependents) === 0) return ok(undefined);
  return err(DomainError.validation(
    `${areaName} has ${describeDependents(dependents)} of this project. Move or remove them first, or close the area to stop new work there and keep its history.`,
    { code: "AREA_HAS_RECORDS", dependents },
  ));
}

/** Closing needs a reason (it is part of the project's history) and an open area; reopening needs a closed one. */
export function checkCloseArea(area: ProjectAreaRecord, reason: string): Result<string, DomainError> {
  if (!isOpenArea(area)) return err(DomainError.validation("This area is already closed"));
  const r = reason.trim();
  if (r.length < 3) return err(DomainError.validation("Say why the project stopped working here", { field: "reason" }));
  if (r.length > CLOSE_REASON_MAX) return err(DomainError.validation(`At most ${CLOSE_REASON_MAX} characters`, { field: "reason" }));
  return ok(r);
}

export function checkReopenArea(area: ProjectAreaRecord): Result<void, DomainError> {
  return isOpenArea(area) ? err(DomainError.validation("This area is already open")) : ok(undefined);
}

/** A new area may not repeat one already chosen nor sit inside one; one that contains finer areas replaces them (`areasInside`), so the footprint stays disjoint. */
export function checkAddArea(placeId: string, areas: readonly ProjectAreaRecord[], tree: PlaceTree): Result<void, DomainError> {
  const place = tree.get(placeId);
  if (!place || place.archived) return err(DomainError.validation("Choose a place that is in your list"));
  for (const a of areas) {
    const other = tree.get(a.placeId);
    if (!other) continue;
    if (other.id === place.id) return err(DomainError.validation(`${place.name} is already one of this project's areas`));
    if (tree.isInside(place.id, other.id)) return err(DomainError.validation(`${place.name} is already covered: it lies inside ${other.name}`));
  }
  return ok(undefined);
}

/** Areas the new one swallows (finer areas inside it): a caller replaces them so the footprint stays disjoint. */
export function areasInside(placeId: string, areas: readonly ProjectAreaRecord[], tree: PlaceTree): ProjectAreaRecord[] {
  return areas.filter((a) => a.placeId !== placeId && tree.isInside(a.placeId, placeId));
}
