/**
 * Which indicators a launch records by place (Phase 53.6). When the person ticked places, every countable indicator the launch creates is
 * recorded one figure per place at the level most ticked areas are at, so the project's map has something to draw from the first value.
 * Rates, ratios and calculated indicators are left as they are. The person can switch it off per indicator afterwards. Pure.
 */
import { willApplyItem } from "../project-codes.js";
import { disaggregationMustSum } from "../../logframe/indicator-disaggregation.js";
import type { IndicatorType } from "../../logframe/indicator.js";
import type { SetupDraft } from "./draft.js";

export interface PlaceRecordingPlan { codes: string[]; level: number | null }

export function placeRecordingForLaunch(draft: SetupDraft): PlaceRecordingPlan {
  const counts = new Map<number, number>();
  for (const item of draft.proposal.places) {
    const v = item.value;
    if (!willApplyItem(item) || !v || v.viaChildren || (v.adminLevel ?? 0) < 1) continue;
    counts.set(v.adminLevel!, (counts.get(v.adminLevel!) ?? 0) + 1);
  }
  if (counts.size === 0) return { codes: [], level: null };
  const level = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
  const codes = draft.proposal.indicators.flatMap((i) => {
    const v = i.value;
    if (!willApplyItem(i) || !v?.code || !v.type) return [];
    return disaggregationMustSum(v.type as IndicatorType) ? [v.code] : [];
  });
  return { codes, level };
}
