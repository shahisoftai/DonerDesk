/**
 * The apply plan (Phase 36): which areas will be written, in what order, and which are left out — derived from the
 * `SETUP_AREAS` table, never hand-listed. An area runs only when the person selected it AND accepted at least one of its
 * items, and only when every area it depends on will run too; a skipped dependency skips everything that needs it, and the
 * skip is reported with its reason rather than dropped silently. Pure and deterministic: the same proposal and choices give
 * the same plan.
 */
import { SETUP_AREAS, SETUP_AREA_APPLY_ORDER, type SetupAreaKey } from "./proposal-areas.js";
import type { ProjectSetupProposal } from "./proposal.js";

export interface ApplyStep {
  area: SetupAreaKey;
  /** The area's fixed place in the apply order (1 first). */
  order: number;
  /** Items that will be written (accepted, or written by the person). */
  items: number;
}

export interface SkippedArea {
  area: SetupAreaKey;
  reason: "NOT_SELECTED" | "NOTHING_ACCEPTED" | "DEPENDENCY_SKIPPED";
  /** For DEPENDENCY_SKIPPED: the area that will not run and made this one impossible. */
  missingDependency?: SetupAreaKey;
}

export interface ApplyPlan {
  steps: ApplyStep[];
  skipped: SkippedArea[];
}

export function planApply(
  proposal: ProjectSetupProposal,
  selected: Readonly<Partial<Record<SetupAreaKey, boolean>>> = {},
): ApplyPlan {
  const ready = new Set<SetupAreaKey>();
  const skipped = new Map<SetupAreaKey, SkippedArea>();
  for (const area of SETUP_AREA_APPLY_ORDER) {
    if (selected[area] !== true) {
      skipped.set(area, { area, reason: "NOT_SELECTED" });
      continue;
    }
    if (SETUP_AREAS[area].accepted(proposal) === 0) {
      skipped.set(area, { area, reason: "NOTHING_ACCEPTED" });
      continue;
    }
    ready.add(area);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const area of [...ready]) {
      const missing = SETUP_AREAS[area].dependsOn.find((d) => !ready.has(d));
      if (missing !== undefined) {
        ready.delete(area);
        skipped.set(area, { area, reason: "DEPENDENCY_SKIPPED", missingDependency: missing });
        changed = true;
      }
    }
  }
  const steps = SETUP_AREA_APPLY_ORDER.filter((area) => ready.has(area)).map((area) => ({
    area,
    order: SETUP_AREAS[area].applyOrder,
    items: SETUP_AREAS[area].accepted(proposal),
  }));
  return { steps, skipped: SETUP_AREA_APPLY_ORDER.filter((area) => skipped.has(area)).map((area) => skipped.get(area)!) };
}
