/**
 * How each indicator will be collected (Phase 38.6). One suggestion per indicator that has no method yet, with the reason in
 * plain words: a form when an activity that feeds it records who took part, typing otherwise. Nothing is chosen for the person,
 * and "calculated" and "connector" are never suggested because the draft cannot know of a formula or an outside tool.
 * Deterministic, reasoned, and never offers what was chosen or rejected.
 */
import type { CollectionMethod, SetupDraft } from "../draft.js";
import { planKeyOf } from "../draft.js";
import { live } from "../requirements/shared.js";

export interface MethodSuggestion {
  /** `METHOD:indicatorCode:method`; what a rejection remembers and an acceptance names. */
  id: string;
  indicatorCode: string;
  method: CollectionMethod;
  reason: string;
}

/** A percentage or ratio is worked out from totals, so a form (which adds records up) cannot collect it. */
export const isRateForForm = (indicator: { type: string | null; unit: string | null }): boolean =>
  indicator.type === "PERCENTAGE" || indicator.type === "RATIO" || (indicator.unit ?? "").trim() === "%";

export function suggestMethods(draft: SetupDraft): MethodSuggestion[] {
  const rejected = new Set(draft.extras.rejectedSuggestions);
  const plans = live(draft.proposal.plan).map((def) => ({ title: def.title, setup: draft.extras.planSetup[planKeyOf(def)] }));
  return live(draft.proposal.indicators).flatMap((indicator) => {
    const code = indicator.code;
    if (code === null || draft.extras.indicatorSetup[code]?.method !== undefined) return [];
    const feeders = plans.filter((p) => p.setup?.indicatorCodes.includes(code));
    const recording = feeders.find((p) => p.setup?.recordsParticipants);
    // A percentage or ratio is worked out from totals: a form cannot add it up, so it is never offered one.
    const isRate = isRateForForm(indicator);
    const [method, reason]: [CollectionMethod, string] = recording && isRate
      ? ["MANUAL", "It is a rate, which a form cannot add up, so its values are typed in."]
      : recording
      ? ["FORM", `“${recording.title ?? "An activity"}” records who took part, so a form can collect this in the field.`]
      : feeders.length > 0
        ? ["MANUAL", "The activities that feed it do not record who took part, so its values are typed in."]
        : ["MANUAL", "No activity feeds it yet, so its values are typed in."];
    const id = `METHOD:${code}:${method}`;
    return rejected.has(id) ? [] : [{ id, indicatorCode: code, method, reason }];
  });
}
