import { toPlainDate, type PlainDate } from "../workplan/plain-date.js";

/**
 * An adaptation: a change to what the project planned or does, kept as a record (what changed, why, and what it did to the results)
 * instead of a paragraph in a report. It can point at the activity, the indicator or the report it touches. Pure.
 */
export interface AdaptationRecord {
  id: string;
  projectId: string;
  /** The day the change was decided or took effect. */
  recordedOn: PlainDate;
  whatChanged: string;
  why: string;
  effectOnResults?: string | undefined;
  plannedActivityId?: string | undefined;
  indicatorId?: string | undefined;
  reportingPeriodId?: string | undefined;
  recordedById: string;
}

export const ADAPTATION_LIMITS = { whatChanged: 500, why: 1000, effectOnResults: 1000 } as const;

export interface AdaptationInput {
  recordedOn: string;
  whatChanged: string;
  why: string;
  effectOnResults?: string | undefined;
}

/** What is wrong with the input, in plain words, or null. */
export function adaptationProblem(input: AdaptationInput): string | null {
  if (!toPlainDate(input.recordedOn) || !/^\d{4}-\d{2}-\d{2}$/.test(input.recordedOn)) return "Give the day the change was made.";
  if (input.whatChanged.trim() === "") return "Say what changed.";
  if (input.why.trim() === "") return "Say why it changed, so the report can explain it.";
  if (input.whatChanged.length > ADAPTATION_LIMITS.whatChanged) return `What changed is too long (${ADAPTATION_LIMITS.whatChanged} characters at most).`;
  if (input.why.length > ADAPTATION_LIMITS.why) return `The reason is too long (${ADAPTATION_LIMITS.why} characters at most).`;
  if ((input.effectOnResults ?? "").length > ADAPTATION_LIMITS.effectOnResults) return `The effect on results is too long (${ADAPTATION_LIMITS.effectOnResults} characters at most).`;
  return null;
}

/** Adaptations made on a day inside the period (inclusive), newest first. */
export function adaptationsInRange<T extends Pick<AdaptationRecord, "recordedOn">>(list: ReadonlyArray<T>, start: PlainDate, end: PlainDate): T[] {
  return list.filter((a) => a.recordedOn >= start && a.recordedOn <= end).sort((a, b) => b.recordedOn.localeCompare(a.recordedOn));
}

const stop = (text: string): string => text.trim().replace(/[.\s]+$/, "");

/** One adaptation as the sentence a report would write; used as a record a claim can be checked against. */
export function adaptationSentence(a: Pick<AdaptationRecord, "recordedOn" | "whatChanged" | "why" | "effectOnResults">): string {
  const effect = a.effectOnResults && a.effectOnResults.trim() !== "" ? ` Effect on results: ${stop(a.effectOnResults)}.` : "";
  return `On ${a.recordedOn}: ${stop(a.whatChanged)}. The reason: ${stop(a.why)}.${effect}`;
}
