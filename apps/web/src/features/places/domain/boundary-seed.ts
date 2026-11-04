/** Turning a country's loaded boundary files into the units the places seed takes. Pure: no React, no fetching. */
import type { SeedUnit } from "@donordesk/domain/contexts/places/index.js";
import type { BoundaryUnit } from "../../maps/domain/boundaries/join.ts";
import { unitsWithin } from "../../maps/domain/boundaries/within.ts";

export type SeedLevel = 1 | 2 | 3 | 4;
export const SEED_LEVELS: readonly SeedLevel[] = [1, 2, 3, 4];

export interface SeedUnits {
  units: SeedUnit[];
  /** Chosen levels left out because the finer level names parents we do not have (the provinces of a source that is not ours). */
  dropped: SeedLevel[];
}

/**
 * One SeedUnit per boundary unit of the chosen levels. A unit's parent is the unit of the next coarser chosen level that its parent
 * P-code names; failing that, the one coarser unit whose outline holds it. Several or none: no parent (it goes under the country, and
 * the server counts it). Never a guess between two candidates.
 *
 * When a finer file names its parents by P-code and none of those codes is in the coarser level, the coarser level is a different
 * division (Natural Earth's provinces against a country's own regions): it is left out and reported, and nothing is placed by position inside it.
 */
export function seedUnitsFrom(byLevel: Partial<Record<SeedLevel, readonly BoundaryUnit[]>>): SeedUnits {
  let levels = SEED_LEVELS.filter((l) => (byLevel[l]?.length ?? 0) > 0);
  const dropped: SeedLevel[] = [];
  // A coarser level whose codes the next finer level never names is not that level's parent set.
  const foreign = new Set<SeedLevel>();
  levels.forEach((level, at) => {
    const next = levels[at + 1];
    if (next === undefined) return;
    const codes = new Set((byLevel[level] ?? []).map((p) => p.pcode).filter(Boolean));
    const named = (byLevel[next] ?? []).filter((u) => u.parentPcode);
    if (named.length > 0 && !named.some((u) => codes.has(u.parentPcode))) foreign.add(level);
  });
  for (const level of foreign) if (level === 1) { dropped.push(level); levels = levels.filter((l) => l !== level); }
  const refOf = new Map<BoundaryUnit, string>();
  const out: SeedUnit[] = [];
  levels.forEach((level) => (byLevel[level] ?? []).forEach((u, i) => refOf.set(u, `${level}:${i}`)));

  levels.forEach((level, at) => {
    const coarserLevel = at > 0 ? levels[at - 1] : undefined;
    const coarser = coarserLevel !== undefined && !foreign.has(coarserLevel) ? byLevel[coarserLevel] ?? [] : [];
    // Which coarser unit holds each unit: computed once per coarser unit, not once per pair.
    const holders = new Map<BoundaryUnit, BoundaryUnit[]>();
    const children = byLevel[level] ?? [];
    const byCode = new Map(coarser.filter((p) => p.pcode).map((p) => [p.pcode, p] as const));
    const needPosition = children.filter((u) => !(u.parentPcode && byCode.has(u.parentPcode)));
    if (needPosition.length > 0) {
      for (const parent of coarser) {
        for (const u of unitsWithin(needPosition, { ...parent, pcode: "" }).units) holders.set(u, [...(holders.get(u) ?? []), parent]);
      }
    }
    for (const u of children) {
      const named = u.parentPcode ? byCode.get(u.parentPcode) : undefined;
      const held = holders.get(u);
      const parent = named ?? (held && held.length === 1 ? held[0] : undefined);
      out.push({
        ref: refOf.get(u)!, level, name: u.name,
        ...(u.pcode ? { code: u.pcode } : {}),
        ...(parent ? { parentRef: refOf.get(parent)! } : {}),
      });
    }
  });
  return { units: out, dropped };
}
