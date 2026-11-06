/**
 * Quick entry (Phase 36): enter one indicator value from a date, without first finding the reporting period, and let a
 * small team skip the hand-in / verify ceremony. Pure rules only; the handler loads and saves.
 *
 * - Derive, don't ask: the period is the one that contains the date (`periodForDate`), the running total is suggested
 *   only for an indicator that adds up (`suggestRunningTotal`), and neither is invented when it cannot be known.
 * - Simple review is a project choice. It never skips a check the product already makes: a value is verified
 *   automatically only by a person who may verify AND only with a file behind it.
 */

import { periodForDate, type DatedPeriod } from "../reporting/period-for-date.js";
import { suggestRunningTotal } from "./indicator-entry-suggestions.js";

export type ReviewMode = "FULL" | "SIMPLE";

export function reviewModeOf(simpleReview: boolean | undefined): ReviewMode {
  return simpleReview ? "SIMPLE" : "FULL";
}

export type QuickEntryPeriodChoice =
  | { ok: true; periodId: string; chosenBy: "DATE" | "PERIOD" }
  | { ok: false; code: "BAD_DATE" | "NO_PERIOD" | "UNKNOWN_PERIOD"; message: string };

const PLAIN_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day written YYYY-MM-DD ("2027-02-30" is not one). */
export function isQuickEntryDay(text: string): boolean {
  if (!PLAIN_DAY.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/**
 * Which period a quick entry belongs to. A period named by the caller must be one of the project's periods; otherwise
 * the date decides. A date no period covers is never assigned to a neighbour: the person is told, and can create the period.
 */
export function chooseQuickEntryPeriod(input: {
  date: string;
  periods: ReadonlyArray<DatedPeriod>;
  periodId?: string | undefined;
}): QuickEntryPeriodChoice {
  if (input.periodId) {
    return input.periods.some((p) => p.id === input.periodId)
      ? { ok: true, periodId: input.periodId, chosenBy: "PERIOD" }
      : { ok: false, code: "UNKNOWN_PERIOD", message: "That reporting period does not belong to this project." };
  }
  if (!isQuickEntryDay(input.date)) return { ok: false, code: "BAD_DATE", message: "Enter the date as year-month-day, for example 2027-03-15." };
  const id = periodForDate(input.periods, input.date);
  if (!id) return { ok: false, code: "NO_PERIOD", message: `No reporting period covers ${input.date}. Create the period for that date first, then enter the value.` };
  return { ok: true, periodId: id, chosenBy: "DATE" };
}

export interface QuickEntryCumulative {
  value: string;
  source: "TYPED" | "SUGGESTED" | "NONE";
}

/** What goes in the running total: the person's own figure, else the suggestion for a summing indicator, else nothing. */
export function quickEntryCumulative(input: {
  aggregation: string;
  periodValue: string;
  typedCumulative?: string | undefined;
  previousCumulative: string | undefined;
}): QuickEntryCumulative {
  const typed = input.typedCumulative?.trim() ?? "";
  if (typed !== "") return { value: typed, source: "TYPED" };
  const suggested = suggestRunningTotal({ aggregation: input.aggregation, periodValue: input.periodValue, previousCumulative: input.previousCumulative });
  return suggested !== undefined ? { value: suggested, source: "SUGGESTED" } : { value: "", source: "NONE" };
}

export type ReviewOutcome = "SAVED_DRAFT" | "HANDED_IN" | "VERIFIED";

export interface ReviewDecision {
  submit: boolean;
  verify: boolean;
  outcome: ReviewOutcome;
  /** One plain sentence for the person, or null when there is nothing to say. */
  notice: string | null;
}

/**
 * What a save does next. In the full workflow nothing happens by itself. With simple review a value that holds a figure is
 * handed in at once; it is also verified when the person saving may verify and a file is attached. A value already handed
 * in or verified is never moved backwards.
 */
export function reviewDecision(input: {
  mode: ReviewMode;
  status: string;
  hasFigure: boolean;
  canVerify: boolean;
  evidenceCount: number;
}): ReviewDecision {
  if (input.status === "VERIFIED") return { submit: false, verify: false, outcome: "VERIFIED", notice: null };
  const alreadyIn = input.status === "SUBMITTED";
  if (input.mode === "FULL") {
    return { submit: false, verify: false, outcome: alreadyIn ? "HANDED_IN" : "SAVED_DRAFT", notice: null };
  }
  if (!input.hasFigure) {
    return { submit: false, verify: false, outcome: "SAVED_DRAFT", notice: "Saved as a draft: there is no figure to hand in yet." };
  }
  const verify = input.canVerify && input.evidenceCount > 0;
  if (verify) return { submit: !alreadyIn, verify: true, outcome: "VERIFIED", notice: "Saved and verified." };
  return {
    submit: !alreadyIn,
    verify: false,
    outcome: "HANDED_IN",
    notice: input.canVerify
      ? "Saved and handed in. Attach a file behind this value to have it verified straight away."
      : "Saved and handed in for review.",
  };
}
