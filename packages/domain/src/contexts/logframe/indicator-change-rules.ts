import type { IndicatorType } from "./indicator.js";

/**
 * What may change about an indicator, decided in one place (pure). The handlers load the facts and
 * apply the answer; they hold no rule of their own.
 */

export interface IndicatorEditFacts {
  currentType: IndicatorType;
  requestedType?: IndicatorType;
  hasValues: boolean;
}

/** A recorded value was entered under one type, so the type cannot change once values exist. */
export function checkIndicatorEdit(facts: IndicatorEditFacts): { allowed: true } | { allowed: false; reason: string } {
  if (facts.requestedType !== undefined && facts.requestedType !== facts.currentType && facts.hasValues) {
    return { allowed: false, reason: "The type cannot change once values have been recorded. Archive this indicator and add a new one." };
  }
  return { allowed: true };
}

export interface IndicatorMoveFacts {
  indicatorProjectId: string;
  currentItemId: string;
  targetItemId: string;
  targetProjectId: string | undefined;
  usedInApprovedReport: boolean;
}

export function checkIndicatorMove(facts: IndicatorMoveFacts): { allowed: true; changes: boolean } | { allowed: false; reason: string } {
  if (facts.targetProjectId === undefined) return { allowed: false, reason: "The logframe item was not found." };
  if (facts.targetProjectId !== facts.indicatorProjectId) return { allowed: false, reason: "An indicator can only move to an item of its own project." };
  if (facts.currentItemId === facts.targetItemId) return { allowed: true, changes: false };
  if (facts.usedInApprovedReport) return { allowed: false, reason: "This indicator is used in an approved report, so it cannot be moved. Reopen the report first." };
  return { allowed: true, changes: true };
}

export type IndicatorRemoval = { outcome: "DELETE" } | { outcome: "ARCHIVE" } | { outcome: "REFUSE"; reason: string };

/** A value-less indicator is deleted; one with values is archived; one an approved report used is neither. */
export function decideIndicatorRemoval(facts: { hasValues: boolean; usedInApprovedReport: boolean }): IndicatorRemoval {
  if (facts.usedInApprovedReport) return { outcome: "REFUSE", reason: "This indicator is used in an approved report, so it cannot be removed. Reopen the report first." };
  return facts.hasValues ? { outcome: "ARCHIVE" } : { outcome: "DELETE" };
}

const PEOPLE_UNIT = /\b(people|persons?|individuals?|beneficiar\w*|households?|famil\w*|children|girls|boys|women|men|students|pupils|participants|farmers|refugees)\b/i;

/** Whether results are, by default, broken down by sex (and age/disability): when the unit counts people. */
export function defaultBreakdown(unit: string | undefined, type: string): boolean {
  if (type !== "NUMBER") return false;
  return unit !== undefined && PEOPLE_UNIT.test(unit);
}
