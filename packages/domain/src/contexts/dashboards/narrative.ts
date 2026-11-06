/**
 * The sentence under a figure (Phase 39.9): what the tile says in words, from facts it already holds. Rules are an ordered table; the first that
 * applies decides, and none applies when there is nothing honest to say (a rate, an unfair comparison, no figure). Pure: it returns a message
 * key and its parameters, never an English sentence, so the screen translates it. No model, no forecast, no cause: only the figure, the
 * period it is for and its share of the target, all of which are already shown or checked elsewhere on the tile.
 */
import type { KpiTile } from "./kpi.js";

export interface Narrative { key: string; params: { percent: number; period: string; target: string } }

type Facts = Pick<KpiTile, "value" | "status" | "percentOfTarget" | "periodLabel" | "target">;

export const NARRATIVE_RULES: ReadonlyArray<{ id: string; when: (f: Facts) => boolean; key: string }> = [
  { id: "NO_FIGURE", when: (f) => f.value === null || f.periodLabel === null, key: "" },
  { id: "NOT_JUDGED", when: (f) => f.status === "NOT_JUDGED" || f.percentOfTarget === null || f.target === null, key: "" },
  { id: "TARGET_MET", when: (f) => f.status === "TARGET_MET", key: "narrative.targetMet" },
  { id: "IN_PROGRESS", when: () => true, key: "narrative.inProgress" },
];

export function kpiNarrative(f: Facts): Narrative | null {
  const rule = NARRATIVE_RULES.find((r) => r.when(f))!;
  if (rule.key === "" || f.percentOfTarget === null || f.periodLabel === null || f.target === null) return null;
  return { key: rule.key, params: { percent: Math.round(f.percentOfTarget), period: f.periodLabel, target: f.target } };
}
