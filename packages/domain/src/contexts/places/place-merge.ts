/**
 * Merging duplicate places (Phase 56). Two rows for one real place (two spellings of a village, a place typed by hand and the same area from
 * the boundaries) become one: every link moves to the place that stays, its children move under it, its spellings become the survivor's other
 * spellings, and the merged row is retired with `mergedIntoId` so old ids still resolve. Organisation-wide, so administrators only. Pure.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { normalizeLocationKey } from "../workplan/location-key.js";
import { PLACE_ALIASES_MAX, placeKeys, type PlaceRecord } from "./place.js";
import type { PlaceTree } from "./place-tree.js";

export interface MergePlan {
  keep: PlaceRecord;
  merged: PlaceRecord;
  /** The survivor after the merge (aliases gained, pin/code taken when it had none). */
  keepAfter: PlaceRecord;
  /** Live children of the merged place, re-parented under the survivor. */
  reparent: string[];
}

/** The one check for a merge. Same level, both live, never into one's own descendant or ancestor, children must fit under the survivor. */
export function checkMerge(keepId: string, mergeId: string, tree: PlaceTree): Result<MergePlan, DomainError> {
  if (keepId === mergeId) return err(DomainError.validation("Choose two different places"));
  const keep = tree.get(keepId);
  const merged = tree.get(mergeId);
  if (!keep || keep.archived || !merged || merged.archived) return err(DomainError.validation("Both places must be in your list"));
  if (keep.adminLevel !== merged.adminLevel) return err(DomainError.validation(`${merged.name} and ${keep.name} are different kinds of place; only places of one level can be merged`));
  if (tree.isInside(keep.id, merged.id) || tree.isInside(merged.id, keep.id)) return err(DomainError.validation("A place cannot be merged with a place inside it"));
  const reparent = tree.children(merged.id).map((c) => c.id);
  const keptNames = new Set(placeKeys(keep));
  const clash = tree.children(merged.id).find((c) => tree.children(keep.id).some((k) => placeKeys(k).some((x) => placeKeys(c).includes(x))));
  if (clash) return err(DomainError.validation(`${clash.name} is inside both places; merge those two first`));
  const extra = [merged.name, ...merged.aliases].filter((t) => { const k = normalizeLocationKey(t); return k && !keptNames.has(k); });
  const aliases = [...new Set([...keep.aliases, ...extra])].slice(0, PLACE_ALIASES_MAX);
  const keepAfter: PlaceRecord = {
    ...keep,
    aliases,
    // A survivor typed with no parent takes the merged place's parent: the merge never loses where a place sits.
    ...(keep.parentId === undefined && merged.parentId !== undefined ? { parentId: merged.parentId } : {}),
    ...(keep.code === undefined && merged.code !== undefined ? { code: merged.code } : {}),
    ...(keep.latitude === undefined && merged.latitude !== undefined && keep.kind === "POINT" ? { latitude: merged.latitude, longitude: merged.longitude } : {}),
  };
  return ok({ keep, merged, keepAfter, reparent });
}

/** Likely duplicates for the administrator to look at: live places of one level under one parent whose names (or spellings) match, or sharing a code. Suggestions only. */
export function suggestDuplicates(tree: PlaceTree, limit = 50): Array<{ keepId: string; mergeId: string; reason: "SAME_NAME" | "SAME_CODE" }> {
  const out: Array<{ keepId: string; mergeId: string; reason: "SAME_NAME" | "SAME_CODE" }> = [];
  const seen = new Set<string>();
  const live = tree.live();
  const push = (a: PlaceRecord, b: PlaceRecord, reason: "SAME_NAME" | "SAME_CODE") => {
    const [keep, merge] = a.id < b.id ? [a, b] : [b, a];
    const key = `${keep.id}|${merge.id}`;
    if (seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push({ keepId: keep.id, mergeId: merge.id, reason });
  };
  const byCode = new Map<string, PlaceRecord>();
  const byName = new Map<string, PlaceRecord[]>();
  for (const p of live) {
    if (p.code) {
      const k = `${p.adminLevel}|${p.code.trim().toLowerCase()}`;
      const hit = byCode.get(k);
      if (hit) push(hit, p, "SAME_CODE"); else byCode.set(k, p);
    }
    for (const key of placeKeys(p)) {
      const k = `${p.adminLevel}|${key}`;
      byName.set(k, [...(byName.get(k) ?? []), p]);
    }
  }
  // Same name at one level is a duplicate only when nothing tells them apart: one of them has no parent, or both share one.
  // The same name under two different districts is two villages, never offered.
  for (const group of byName.values()) {
    for (let i = 0; i < group.length; i += 1) for (let j = i + 1; j < group.length; j += 1) {
      const a = group[i]!; const b = group[j]!;
      if (a.id !== b.id && (!a.parentId || !b.parentId || a.parentId === b.parentId)) push(a, b, "SAME_NAME");
    }
  }
  return out;
}
