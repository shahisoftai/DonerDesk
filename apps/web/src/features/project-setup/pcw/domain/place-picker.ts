/**
 * The Places slide's selection, as pure rules (Phase 43). A person ticks areas in a tree of the country's boundaries; this file knows what a
 * tick means and turns it into the one operation the draft stores. Nothing here draws, loads or saves.
 *
 *  - Ticking an area means the project works across all of it. An area inside a ticked one shows as covered and cannot be ticked alone
 *    (untick the larger one first); ticking a larger area replaces ticks inside it.
 *  - An area with ticks inside it, but not ticked itself, shows as "some". It is listed only so the places have their parent.
 *  - The hierarchy comes from the file's parent P-codes when it has them, else from position (the same rule the map uses), never from names alone.
 */
import { unitsWithin } from "../../../maps/domain/boundaries/within.ts";
import { geometryBounds } from "../../../maps/domain/model/bounds.ts";
import { geometryContains } from "../../../maps/domain/point-in-area.ts";
import type { BoundaryUnit } from "../../../maps/domain/boundaries/join.ts";
import { normalizeLocationKey } from "@donordesk/domain/contexts/workplan/index.js";
import type { BoundaryPick } from "@donordesk/domain";
import type { PlaceDef } from "@donordesk/domain";

/** An area as the selection knows it (no shape). */
export interface PickRef { ref: string; code: string | null; name: string; level: number; parentRef: string | null }
/** A ticked area with the areas above it, widest first (the country is not in the chain). */
export interface PickEntry { node: PickRef; chain: readonly PickRef[] }
export type Selection = ReadonlyMap<string, PickEntry>;
export type TickState = "ON" | "INSIDE" | "SOME" | "OFF";

export const EMPTY_SELECTION: Selection = new Map();

export const refOf = (u: BoundaryUnit, level: number, parent: PickRef | null): PickRef => ({ ref: u.ref, code: u.pcode || null, name: u.name, level, parentRef: parent?.ref ?? null });

/** Refs of areas that have a ticked area somewhere inside them. */
export const someRefs = (sel: Selection): ReadonlySet<string> => {
  const out = new Set<string>();
  for (const e of sel.values()) for (const c of e.chain) out.add(c.ref);
  return out;
};

export function tickState(sel: Selection, some: ReadonlySet<string>, node: PickRef, ancestors: readonly PickRef[]): TickState {
  if (sel.has(node.ref)) return "ON";
  if (ancestors.some((a) => sel.has(a.ref))) return "INSIDE";
  return some.has(node.ref) ? "SOME" : "OFF";
}

/** Ticks or unticks `node`. An area inside a ticked one is left alone; ticking a larger area drops the ticks inside it. */
export function toggle(sel: Selection, node: PickRef, ancestors: readonly PickRef[]): Selection {
  if (sel.has(node.ref)) { const next = new Map(sel); next.delete(node.ref); return next; }
  if (ancestors.some((a) => sel.has(a.ref))) return sel;
  const next = new Map([...sel].filter(([, e]) => !e.chain.some((c) => c.ref === node.ref)));
  next.set(node.ref, { node, chain: ancestors });
  return next;
}

export const clearAll = (): Selection => EMPTY_SELECTION;

/** Ticked areas by level: `{ 2: 3, 3: 12 }`. Areas listed only as parents are not counted. */
export function countsByLevel(sel: Selection): Record<number, number> {
  const out: Record<number, number> = {};
  for (const e of sel.values()) out[e.node.level] = (out[e.node.level] ?? 0) + 1;
  return out;
}

/** The areas the draft stores: every ticked area, and above each the areas it sits in (marked as parents only). */
export function toPicks(sel: Selection): BoundaryPick[] {
  const picks = new Map<string, BoundaryPick>();
  const pick = (n: PickRef, viaChildren: boolean): BoundaryPick => ({ ref: n.ref, code: n.code, name: n.name, adminLevel: n.level, parentRef: n.parentRef, viaChildren });
  for (const e of sel.values()) for (const c of e.chain) if (!picks.has(c.ref)) picks.set(c.ref, pick(c, true));
  for (const e of sel.values()) picks.set(e.node.ref, pick(e.node, false));
  return [...picks.values()];
}

/** The selection a draft already holds, rebuilt from its places (so the ticks are there when the slide is opened again). */
export function selectionFromPlaces(places: readonly PlaceDef[]): Selection {
  const mapped = places.filter((p) => p.mapRef && (p.adminLevel ?? 0) >= 1 && p.name);
  const byName = new Map(mapped.map((p) => [normalizeLocationKey(p.name!), p]));
  const refOfDef = (p: PlaceDef): PickRef => {
    const parent = p.parentName ? byName.get(normalizeLocationKey(p.parentName)) : undefined;
    return { ref: p.mapRef!, code: p.code ?? null, name: p.name!, level: p.adminLevel!, parentRef: parent?.mapRef ?? null };
  };
  const out = new Map<string, PickEntry>();
  for (const p of mapped.filter((x) => !x.viaChildren)) {
    const chain: PickRef[] = [];
    for (let up = p.parentName ? byName.get(normalizeLocationKey(p.parentName)) : undefined; up && chain.length < 5 && !chain.some((c) => c.ref === up!.mapRef); up = up.parentName ? byName.get(normalizeLocationKey(up.parentName)) : undefined) chain.unshift(refOfDef(up));
    out.set(p.mapRef!, { node: refOfDef(p), chain });
  }
  return out;
}

/** The country's areas at `level` that sit inside `parent` (the first level: all of them). Same rule as the map's drill. */
export function childrenOf(all: readonly BoundaryUnit[], parent: BoundaryUnit | null): BoundaryUnit[] {
  const list = parent ? unitsWithin(all, parent).units : [...all];
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

/** The levels a country offers below the country, ascending. */
export const nextLevel = (level: number, levels: readonly number[]): number | null => levels.filter((l) => l > level).sort((a, b) => a - b)[0] ?? null;

// ---- finding an area's parents without opening the tree (document places, search) ------------------------------------------------------

type Box = readonly [number, number, number, number];
const centreOf = (box: Box): [number, number] => [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];

/** The area at the level above that holds `unit`: by parent P-code when the file has them, else by position (centre, then first corner). Null when nothing does. */
export function findParent(unit: BoundaryUnit, candidates: readonly BoundaryUnit[], boxes: Map<string, Box | null> = new Map()): BoundaryUnit | null {
  if (unit.parentPcode) {
    const byCode = candidates.find((c) => c.pcode && c.pcode === unit.parentPcode);
    if (byCode) return byCode;
  }
  const own = geometryBounds(unit.geometry);
  if (!own) return null;
  const [cx, cy] = centreOf(own);
  for (const c of candidates) {
    let box = boxes.get(c.ref);
    if (box === undefined) { box = geometryBounds(c.geometry); boxes.set(c.ref, box); }
    if (!box || cx < box[0] || cx > box[2] || cy < box[1] || cy > box[3]) continue;
    if (geometryContains(c.geometry, cy, cx)) return c;
  }
  return null;
}

export type LevelUnits = ReadonlyMap<number, readonly BoundaryUnit[]>;

/** `unit` as a ticked area with its chain of parents, resolved up through the levels the country has. */
export function entryFor(unit: BoundaryUnit, level: number, levels: LevelUnits): PickEntry {
  const order = [...levels.keys()].filter((l) => l < level).sort((a, b) => b - a);
  const boxes = new Map<string, Box | null>();
  const chain: PickRef[] = [];
  let cur: BoundaryUnit = unit;
  for (const l of order) {
    const parent = findParent(cur, levels.get(l) ?? [], boxes);
    if (!parent) continue;
    chain.unshift({ ref: parent.ref, code: parent.pcode || null, name: parent.name, level: l, parentRef: null });
    cur = parent;
  }
  const linked = chain.map((c, i) => ({ ...c, parentRef: i === 0 ? null : chain[i - 1]!.ref }));
  const parentRef = linked[linked.length - 1]?.ref ?? null;
  return { node: { ref: unit.ref, code: unit.pcode || null, name: unit.name, level, parentRef }, chain: linked };
}

// ---- search and document places ---------------------------------------------------------------------------------------------------------

export interface Found { unit: BoundaryUnit; level: number }

/** Areas whose name contains the words typed, widest level first, at most `limit`. */
export function searchAreas(levels: LevelUnits, query: string, limit = 40): Found[] {
  const q = normalizeLocationKey(query);
  if (q.length < 2) return [];
  const out: Found[] = [];
  for (const level of [...levels.keys()].sort((a, b) => a - b)) {
    for (const unit of levels.get(level) ?? []) {
      if (normalizeLocationKey(unit.name).includes(q)) out.push({ unit, level });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export interface DocumentMatch { index: number; found: Found }
export interface DocumentMatches { matched: DocumentMatch[]; /** Indexes of places no single area answers to (no area, or several with that name). */ unmatched: number[] }

/** Places a document proposed, matched to areas by name (and level, when the document says it). A name shared by several areas is not guessed. */
export function matchDocumentPlaces(defs: ReadonlyArray<{ index: number; place: PlaceDef }>, levels: LevelUnits): DocumentMatches {
  const byName = new Map<string, Found[]>();
  for (const level of levels.keys()) for (const unit of levels.get(level) ?? []) {
    const key = normalizeLocationKey(unit.name);
    byName.set(key, [...(byName.get(key) ?? []), { unit, level }]);
  }
  const matched: DocumentMatch[] = [];
  const unmatched: number[] = [];
  for (const { index, place } of defs) {
    let hits = (byName.get(normalizeLocationKey(place.name ?? "")) ?? []).filter((h) => place.adminLevel === null || place.adminLevel === h.level || place.adminLevel === 0);
    // The same name can exist at two levels (a sub-district and its union council) or in two districts: the place the document says it is inside decides, when it can.
    if (hits.length > 1 && place.parentName) {
      const parent = normalizeLocationKey(place.parentName);
      const inside = hits.filter((h) => entryFor(h.unit, h.level, levels).chain.some((c) => normalizeLocationKey(c.name) === parent));
      if (inside.length === 0) { unmatched.push(index); continue; }
      hits = inside;
      // Still two inside it: a sub-district and a smaller area of the same name. The wider one holds the smaller, so it is the one that is never wrong to tick.
      if (hits.length > 1 && new Set(hits.map((h) => h.level)).size === hits.length) hits = [[...hits].sort((a, b) => a.level - b.level)[0]!];
    }
    if (hits.length === 1) matched.push({ index, found: hits[0]! }); else unmatched.push(index);
  }
  return { matched, unmatched };
}

// ---- the tree's rows ----------------------------------------------------------------------------------------------------------------

/** One line of the tree: an area, the areas above it, and whether a finer level exists under it. */
export interface Row { node: PickRef; unit: BoundaryUnit; ancestors: readonly PickRef[]; depth: number; canOpen: boolean }

/** The areas of the first level, and under each one that is open the next level's areas inside it. `cache` keeps the "inside" work between renders. */
export function visibleRows(levels: readonly number[], units: LevelUnits, open: ReadonlySet<string>, cache: Map<string, BoundaryUnit[]> = new Map()): Row[] {
  const out: Row[] = [];
  const top = levels[0];
  if (top === undefined) return out;
  const walk = (list: readonly BoundaryUnit[], level: number, ancestors: readonly PickRef[]): void => {
    const next = nextLevel(level, levels);
    for (const unit of list) {
      const node = refOf(unit, level, ancestors[ancestors.length - 1] ?? null);
      out.push({ node, unit, ancestors, depth: ancestors.length, canOpen: next !== null });
      const below = next === null ? undefined : units.get(next);
      if (!open.has(node.ref) || !below) continue;
      let kids = cache.get(node.ref);
      if (!kids) { kids = childrenOf(below, unit); cache.set(node.ref, kids); }
      walk(kids, next!, [...ancestors, node]);
    }
  };
  walk([...(units.get(top) ?? [])].sort((a, b) => a.name.localeCompare(b.name)), top, []);
  return out;
}

/** The areas a map shows when `focus` is open: the areas inside it, or the first level at the country. Null until that level has loaded. */
export function focusUnits(levels: readonly number[], units: LevelUnits, focus: Row | null, cache: Map<string, BoundaryUnit[]> = new Map()): { level: number; list: BoundaryUnit[] } | null {
  if (!focus) { const top = levels[0]; return top === undefined || !units.get(top) ? null : { level: top, list: [...units.get(top)!] }; }
  const next = nextLevel(focus.node.level, levels);
  const below = next === null ? undefined : units.get(next);
  if (next === null || !below) return null;
  let kids = cache.get(focus.node.ref);
  if (!kids) { kids = childrenOf(below, focus.unit); cache.set(focus.node.ref, kids); }
  return { level: next, list: kids };
}
