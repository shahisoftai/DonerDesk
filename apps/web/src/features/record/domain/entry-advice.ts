/**
 * Notes shown while someone types a value (Phase 44): a locked report, a day no period covers, a value already saved for that day,
 * a breakdown still missing, no file behind the figure, an indicator not due this period, a date in the future, a value sent back.
 * One ordered table. A note NEVER stops a save by itself: `blocksSave` is true only where the server would refuse anyway (a locked
 * report, a day no period covers), and the note says so before the person has typed anything. Pure: today comes in as an argument.
 */
import type { DateLanding } from "../../reporting/domain/quick-entry-view.ts";

export type AdviceKey =
  | "LOCKED_PERIOD"
  | "NO_PERIOD_FOR_DAY"
  | "BAD_DAY"
  | "RETURNED_NEEDS_CHANGE"
  | "DUPLICATE_VALUE"
  | "MISSING_BREAKDOWN"
  | "MISSING_FILE"
  | "NOT_DUE"
  | "FUTURE_DATE";

export type AdviceTone = "info" | "attention";

export interface AdviceInput {
  /** Today as a plain day `YYYY-MM-DD`. */
  today: string;
  date: string;
  landing: DateLanding;
  indicator?: {
    code: string;
    disaggregationRequired?: boolean | undefined;
    /** False when the indicator is not due in the period the day lands in. Unknown (undefined) says nothing. */
    dueInPeriod?: boolean | undefined;
  } | undefined;
  /** A required breakdown has been typed completely. */
  breakdownComplete?: boolean | undefined;
  /** A value already saved for this indicator and day (or period). */
  existingValue?: { value: string; by?: string | undefined } | null | undefined;
  hasFile?: boolean | undefined;
  /** The project asks for a file behind a figure (simple review verifies only with one). */
  fileWanted?: boolean | undefined;
  /** The reviewer's reason when this value was sent back. */
  returnedReason?: string | null | undefined;
}

export interface Advice {
  key: AdviceKey;
  tone: AdviceTone;
  blocksSave: boolean;
  /** Values for the catalogue sentence `record.advice.<KEY>`. */
  params: Record<string, string>;
}

interface AdviceRule {
  key: AdviceKey;
  tone: AdviceTone;
  blocksSave: boolean;
  applies: (input: AdviceInput) => boolean;
  params?: (input: AdviceInput) => Record<string, string>;
}

/** Order is the order the notes are shown in: what stops a save first, then what to fix, then what to know. */
export const ENTRY_ADVICE_RULES: readonly AdviceRule[] = [
  { key: "BAD_DAY", tone: "attention", blocksSave: true, applies: (i) => i.landing.kind === "INVALID" },
  { key: "NO_PERIOD_FOR_DAY", tone: "attention", blocksSave: true, applies: (i) => i.landing.kind === "NONE", params: (i) => ({ date: i.date }) },
  { key: "LOCKED_PERIOD", tone: "attention", blocksSave: true, applies: (i) => i.landing.kind === "FOUND" && i.landing.locked, params: (i) => ({ period: i.landing.kind === "FOUND" ? i.landing.label : "" }) },
  { key: "RETURNED_NEEDS_CHANGE", tone: "attention", blocksSave: false, applies: (i) => Boolean(i.returnedReason?.trim()), params: (i) => ({ reason: i.returnedReason?.trim() ?? "" }) },
  { key: "MISSING_BREAKDOWN", tone: "info", blocksSave: false, applies: (i) => Boolean(i.indicator?.disaggregationRequired) && i.breakdownComplete !== true, params: (i) => ({ code: i.indicator?.code ?? "" }) },
  { key: "DUPLICATE_VALUE", tone: "info", blocksSave: false, applies: (i) => Boolean(i.existingValue), params: (i) => ({ value: i.existingValue?.value ?? "", by: i.existingValue?.by ?? "" }) },
  { key: "MISSING_FILE", tone: "info", blocksSave: false, applies: (i) => i.fileWanted === true && i.hasFile !== true, params: (i) => ({ code: i.indicator?.code ?? "" }) },
  { key: "NOT_DUE", tone: "info", blocksSave: false, applies: (i) => i.indicator?.dueInPeriod === false, params: (i) => ({ code: i.indicator?.code ?? "" }) },
  { key: "FUTURE_DATE", tone: "attention", blocksSave: false, applies: (i) => i.landing.kind !== "INVALID" && i.date > i.today },
];

export function adviceFor(input: AdviceInput, rules: readonly AdviceRule[] = ENTRY_ADVICE_RULES): Advice[] {
  return rules.filter((r) => r.applies(input)).map((r) => ({ key: r.key, tone: r.tone, blocksSave: r.blocksSave, params: r.params?.(input) ?? {} }));
}

/** True when any note says the save would be refused. The Save button reads this and prints the note beside itself. */
export function savingIsBlocked(advice: readonly Advice[]): boolean {
  return advice.some((a) => a.blocksSave);
}
