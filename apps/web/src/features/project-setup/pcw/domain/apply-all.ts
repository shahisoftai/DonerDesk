import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";
import type { SlideKey } from "@donordesk/domain";

/**
 * "Apply to all" (Phase 59): one value written to every row that has none. A new field is a row in `APPLY_ALL_FIELDS`; the
 * component that draws the button and the code that runs it never name a field. Nothing already chosen is overwritten.
 */
export type ApplyAllField = "owner" | "direction" | "lead";

export interface ApplyAllDef {
  slide: SlideKey;
  /** The keys of the rows that have no value yet (an indicator's code, a planned activity's key). */
  targets(view: SetupDraftView): string[];
  /** The draft edit that sets the value for one row. */
  edit(target: string, value: string): { kind: "SET_INDICATOR_SETUP"; code: string; patch: Record<string, unknown> } | { kind: "SET_PLAN_SETUP"; planKey: string; patch: Record<string, unknown> };
}

const indicatorCodes = (view: SetupDraftView): string[] => view.indicators.filter((i) => i.status !== "REJECTED").flatMap((i) => ((i.value as { code: string | null }).code ? [(i.value as { code: string }).code] : []));

export const APPLY_ALL_FIELDS: Record<ApplyAllField, ApplyAllDef> = {
  owner: {
    slide: "INDICATORS",
    targets: (view) => indicatorCodes(view).filter((code) => !view.extras.indicatorSetup[code]?.ownerKey),
    edit: (code, value) => ({ kind: "SET_INDICATOR_SETUP", code, patch: { ownerKey: value } }),
  },
  direction: {
    slide: "INDICATORS",
    targets: (view) => indicatorCodes(view).filter((code) => !view.extras.indicatorSetup[code]?.direction),
    edit: (code, value) => ({ kind: "SET_INDICATOR_SETUP", code, patch: { direction: value, directionConfirmed: true } }),
  },
  lead: {
    slide: "WORK_PLAN",
    targets: (view) => view.plan.filter((p) => p.status !== "REJECTED" && !view.extras.planSetup[p.planKey]?.leadKey).map((p) => p.planKey),
    edit: (planKey, value) => ({ kind: "SET_PLAN_SETUP", planKey, patch: { leadKey: value } }),
  },
};

export const applyAllTargets = (view: SetupDraftView, field: ApplyAllField): string[] => APPLY_ALL_FIELDS[field].targets(view);
