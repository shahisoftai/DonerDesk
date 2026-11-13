import { isPlanCode, resolvePlan, type PlanLimits } from "./plan.js";

/** Why the Ask assistant is or is not open to a person; one answer, read by the API, Settings and the floating button. */
export type AskAccess = "AVAILABLE" | "NOT_IN_PLAN" | "NOT_TURNED_ON" | "NO_AI" | "PARTNER";

export interface AskAccessFacts {
  planCode: string;
  /** The effective limits; a row stored before Ask became a plan feature has no `askAssistant`. */
  limits: Partial<Pick<PlanLimits, "askAssistant">>;
  /** The organisation's opt-in (`Organization.askEnabled`). */
  askEnabled: boolean;
  /** Whether the organisation has AI on (`Organization.aiEnabled`). */
  aiEnabled: boolean;
  /** An outside partner (`User.external`). */
  external: boolean;
}

/** Whether the plan includes Ask: the stored limit when there is one, else the plan's own catalogue value (never a guess for an unknown plan). */
export function planIncludesAsk(planCode: string, limits: AskAccessFacts["limits"]): boolean {
  if (typeof limits.askAssistant === "boolean") return limits.askAssistant;
  return isPlanCode(planCode) ? resolvePlan(planCode).askAssistant : false;
}

/**
 * The one rule for Ask: a partner never; then the plan must include it; then an administrator must have turned it on; then the
 * organisation needs AI. The order is the order of the sentence a person is told.
 */
export function askAccess(facts: AskAccessFacts): AskAccess {
  if (facts.external) return "PARTNER";
  if (!planIncludesAsk(facts.planCode, facts.limits)) return "NOT_IN_PLAN";
  if (!facts.askEnabled) return "NOT_TURNED_ON";
  if (!facts.aiEnabled) return "NO_AI";
  return "AVAILABLE";
}
