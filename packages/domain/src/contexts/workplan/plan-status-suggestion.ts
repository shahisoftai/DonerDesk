/**
 * Status suggestions, never automation: completed activities only *suggest* a change; a person confirms
 * ("Mark activity done?"). Nothing here changes a stored status.
 */
import type { DeliveryFacts } from "./delivery-state.js";
import type { PlanStatus } from "./plan-status-transitions.js";

export interface SuggestionItem {
  status: PlanStatus;
  plannedStart: string;
  plannedEnd: string;
  targetCount?: number;
}

export function suggestPlanStatus(item: SuggestionItem, facts: DeliveryFacts): "IN_PROGRESS" | "DONE" | undefined {
  if (item.status === "DONE" || item.status === "CANCELLED") return undefined;
  const singleDate = item.plannedStart === item.plannedEnd;
  const reachedTarget = item.targetCount !== undefined && item.targetCount > 0 && facts.deliveredCount >= item.targetCount;
  if (reachedTarget || (singleDate && item.targetCount === undefined && facts.acceptedRecords > 0)) return "DONE";
  if (item.status === "PLANNED" && facts.liveRecords > 0) return "IN_PROGRESS";
  return undefined;
}
