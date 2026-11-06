/** Helpers every slide's requirement rules share (pure). */
import type { Proposed } from "../../proposal.js";
import type { RequirementCode, Verdict } from "../requirement.js";

export const MET: Verdict = { met: true };

/** An item that will be applied: accepted or written by the person, with a value. */
export const isLive = (item: Proposed<unknown>): boolean => (item.status === "ACCEPTED" || item.status === "EDITED") && item.value !== null;

/** The values of the items that will be applied. */
export function live<T>(items: ReadonlyArray<Proposed<T>>): T[] {
  return items.filter(isLive).map((i) => i.value as T);
}

/** Items nobody has decided yet (neither accepted, edited nor rejected). */
export const undecidedCount = (items: ReadonlyArray<Proposed<unknown>>): number => items.filter((i) => i.status === "PROPOSED" && i.value !== null).length;

export const open = (code: RequirementCode, params?: Record<string, string | number>, itemKey?: string): Verdict => ({ met: false, code, params, itemKey });

/** MET, or OPEN naming how many are wrong and the first of them (so the inbox can jump to it). */
export function allOf(problems: readonly string[], code: RequirementCode): Verdict {
  return problems.length === 0 ? MET : open(code, { count: problems.length, first: problems[0]! }, problems[0]);
}

export const present = (value: string | null | undefined): boolean => typeof value === "string" && value.trim().length > 0;
