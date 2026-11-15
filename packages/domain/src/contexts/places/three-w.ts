/**
 * Who does what where (Phase 56): the organisation's map of its work, derived from every project's footprint and linked records, never kept
 * by hand. Each record counts toward the area at the chosen level that contains its place; a record whose place has nothing at that level is
 * counted apart as "not placed at this level", never spread or guessed. Projects are listed, figures are not added across projects here (the
 * figures by place come from the results roll-up, which applies `countedElsewhere`). Pure; no node: imports.
 */
import type { AdminLevel } from "./place.js";
import type { PlaceTree } from "./place-tree.js";
import type { ProjectAreaRecord } from "./footprint.js";

export interface ThreeWProject {
  id: string;
  name: string;
  sector?: string | undefined;
  areas: readonly ProjectAreaRecord[];
}

/** One linked record: which project, which kind, which place. */
export interface ThreeWLink {
  projectId: string;
  kind: "PLANNED_ACTIVITY" | "ACTIVITY";
  placeId: string;
}

/** Which count each kind of linked work adds to (one table; nothing branches on the kind). */
export const THREE_W_FIELD: Readonly<Record<ThreeWLink["kind"], "plannedActivities" | "activities">> = {
  PLANNED_ACTIVITY: "plannedActivities",
  ACTIVITY: "activities",
};

export interface ThreeWArea {
  placeId: string;
  name: string;
  path: string;
  /** Projects whose footprint covers this area, or that recorded work inside it. */
  projectIds: string[];
  plannedActivities: number;
  activities: number;
}

export interface ThreeWResult {
  level: AdminLevel;
  areas: ThreeWArea[];
  /** Links whose place has no area at this level (a country-wide record when looking at districts). */
  notPlacedAtLevel: number;
}

/** The area at `level` a place counts toward: its own ancestor at that level, else undefined (coarser places are not pushed down). */
function areaAt(tree: PlaceTree, placeId: string, level: AdminLevel): string | undefined {
  return tree.chain(placeId).find((p) => p.adminLevel === level)?.id;
}

export function whoWhatWhere(projects: readonly ThreeWProject[], links: readonly ThreeWLink[], tree: PlaceTree, level: AdminLevel): ThreeWResult {
  const rows = new Map<string, { projects: Set<string>; plannedActivities: number; activities: number }>();
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) { r = { projects: new Set(), plannedActivities: 0, activities: 0 }; rows.set(id, r); }
    return r;
  };
  for (const p of projects) {
    for (const a of p.areas) {
      const id = tree.current(a.placeId);
      if (!id || !tree.isLive(id)) continue;
      const self = tree.get(id)!;
      if (self.adminLevel === level) row(id).projects.add(p.id);
      else if (self.adminLevel < level) for (const d of tree.descendants(id)) { if (tree.get(d)?.adminLevel === level) row(d).projects.add(p.id); }
      else { const up = areaAt(tree, id, level); if (up) row(up).projects.add(p.id); }
    }
  }
  let notPlacedAtLevel = 0;
  for (const l of links) {
    const at = areaAt(tree, l.placeId, level);
    if (!at) { notPlacedAtLevel += 1; continue; }
    const r = row(at);
    r.projects.add(l.projectId);
    r[THREE_W_FIELD[l.kind]] += 1;
  }
  const areas = [...rows].map(([placeId, r]) => ({
    placeId, name: tree.get(placeId)?.name ?? "", path: tree.path(placeId),
    projectIds: [...r.projects].sort(), plannedActivities: r.plannedActivities, activities: r.activities,
  })).sort((a, b) => b.projectIds.length - a.projectIds.length || a.path.localeCompare(b.path));
  return { level, areas, notPlacedAtLevel };
}

/** Areas where more than one project works: where coordination (and double counting) matters. */
export function overlaps(result: ThreeWResult): ThreeWArea[] {
  return result.areas.filter((a) => a.projectIds.length > 1);
}
