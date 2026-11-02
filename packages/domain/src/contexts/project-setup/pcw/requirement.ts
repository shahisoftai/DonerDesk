/**
 * Setup requirements (Phase 38): one pure rule per thing that must hold before Launch, each owned by a slide. A requirement is
 * OPEN, MET, or NOT_USED (the person said the project does not use it; the reason is optional). The gap inbox, each slide's
 * progress and the Launch gate are all derived from `evaluateRequirements`; nothing about them is stored, so an edit on one
 * slide re-opens what it breaks on another. A new requirement is a row in a slide's list, never a branch here.
 */
import type { SetupDraft } from "./draft.js";
import type { SlideKey } from "./slides.js";
import { SLIDE_KEYS } from "./slides.js";

/**
 * Every sentence a requirement can say, by code. The web catalogue is keyed on this list, so a requirement that gains a new
 * code does not compile until its sentence is written in every language.
 */
export const REQUIREMENT_CODES = [
  "donorMissing", "sectorMissing", "countryMissing",
  "factsMissing", "datesOrder", "managerMissing", "meMissing", "partnersMissing",
  "resultsUndecided", "resultsEmpty", "resultsBroken", "codesUnconfirmed",
  "indicatorsUndecided", "outputWithoutIndicator", "indicatorIncomplete", "indicatorWithoutOwner", "directionUnconfirmed",
  "placesEmpty", "placesUndecided", "projectAreaMissing",
  "planUndecided", "activityWithoutPlan", "planIncomplete", "planWithoutIndicator", "indicatorNotFed",
  "methodMissing", "reviewModeMissing", "windowRuleMissing",
  "cadenceMissing", "reportRulesMissing", "reportRuleIncomplete",
  "fundingMissing", "budgetUndecided", "budgetLineUnlinked", "reportingCurrencyMissing", "budgetDiffers", 
  "risksUndecided", "risksMissing", "risksUnrated", "assumptionsMissing", "dashboardMissing",
] as const;
export type RequirementCode = (typeof REQUIREMENT_CODES)[number];

export type RequirementParams = Record<string, string | number>;

/** What a check says. `code` is the plain-language sentence's key in the catalogue (`pcw.req.<code>`); params fill it. */
export type Verdict = { met: true } | { met: false; code: RequirementCode; params?: RequirementParams; itemKey?: string };

export interface RequirementDef {
  /** Unique, `<area>.<what>` (a person's "not used" answer is stored under it). */
  key: string;
  slide: SlideKey;
  /** The numbers (1-47) of the setup steps this requirement covers; a test pins that all 47 are covered. */
  coversSteps: readonly number[];
  allowsNotUsed: boolean;
  /** Another requirement's key: answering that one "not used" turns this one off too (finance off switches the slide off). */
  unlessNotUsed?: string;
  check: (draft: SetupDraft) => Verdict;
}

export type RequirementStatus = "OPEN" | "MET" | "NOT_USED";

export interface RequirementResult {
  key: string;
  slide: SlideKey;
  status: RequirementStatus;
  code?: RequirementCode;
  params?: RequirementParams;
  itemKey?: string;
}

export function evaluateRequirement(def: RequirementDef, draft: SetupDraft): RequirementResult {
  const answers = draft.extras.answers;
  const off = (def.allowsNotUsed && answers[def.key]?.notUsed === true) || (def.unlessNotUsed !== undefined && answers[def.unlessNotUsed]?.notUsed === true);
  if (off) return { key: def.key, slide: def.slide, status: "NOT_USED" };
  const verdict = def.check(draft);
  if (verdict.met) return { key: def.key, slide: def.slide, status: "MET" };
  return { key: def.key, slide: def.slide, status: "OPEN", code: verdict.code, params: verdict.params, itemKey: verdict.itemKey };
}

export function evaluateRequirements(draft: SetupDraft, defs: readonly RequirementDef[]): RequirementResult[] {
  return defs.map((def) => evaluateRequirement(def, draft));
}

/** Everything still open, in the order the guide takes a person through the slides. */
export function gapInbox(results: readonly RequirementResult[]): RequirementResult[] {
  const order = new Map(SLIDE_KEYS.map((key, i) => [key, i] as const));
  return results.filter((r) => r.status === "OPEN").sort((a, b) => (order.get(a.slide) ?? 0) - (order.get(b.slide) ?? 0));
}

export interface SlideProgress {
  slide: SlideKey;
  total: number;
  open: number;
  /** A slide with no requirement left open (a slide with none is complete). */
  complete: boolean;
}

export function slideProgress(results: readonly RequirementResult[], slide: SlideKey): SlideProgress {
  const own = results.filter((r) => r.slide === slide);
  const open = own.filter((r) => r.status === "OPEN").length;
  return { slide, total: own.length, open, complete: open === 0 };
}
