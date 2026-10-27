/**
 * The light on the entry grid (Phase 33.3): is the value being entered at or above its target, or below it? It uses the
 * rules reports already use — the target scheduled for the period (cumulative), a period total of a SUM indicator judged
 * through its cumulative figure, a lower-is-better indicator read the other way — and it never invents a middle band: a
 * light is green (target met or beaten) or amber (below target), and otherwise there is no light and the reason says why.
 *
 * No light when the comparison would not be fair:
 *  - how the indicator is read is not confirmed (direction unknown),
 *  - no value has been entered, or there is no target,
 *  - a total (SUM) has only the project's final target: month one is not "behind" a target due at the end. A target
 *    schedule makes it fair.
 * Pure: no clock (the period end is passed in).
 */
import { evaluatePerformance } from "./indicator-calculator.js";
import { targetForPeriod, varianceAgainst, describeVariance, type TargetSchedule } from "../logframe/target-schedule.js";
import type { IndicatorSemantics } from "../logframe/indicator-semantics.js";

export type StoplightLight = "MET" | "BELOW" | "NONE";

export interface EntryStoplight {
  light: StoplightLight;
  /** The target it was judged against, when there is a light. */
  target?: string;
  /** What was compared (the period value, or the cumulative figure for a total), when there is a light. */
  compared?: string;
  /** "+12 (+8%)" against the target, when there is a light and the target is not zero. */
  variance?: string;
  /** One sentence: why this light, or why none. */
  note: string;
}

export interface EntryStoplightInput {
  semantics: IndicatorSemantics;
  baseline?: string | undefined;
  target?: string | undefined;
  schedule?: TargetSchedule | undefined;
  /** The period's end, a plain day (YYYY-MM-DD). */
  periodEnd: string;
  periodValue?: string | undefined;
  cumulativeValue?: string | undefined;
}

const NO = (note: string): EntryStoplight => ({ light: "NONE", note });
const blank = (v: string | undefined): boolean => v === undefined || v.trim() === "";

export function entryStoplight(input: EntryStoplightInput): EntryStoplight {
  const { semantics } = input;
  if (semantics.status === "REQUIRES_REVIEW" || semantics.direction === "NEUTRAL") return NO("How this indicator is read has not been confirmed, so it is not judged against its target.");
  const schedule = input.schedule ?? [];
  const scheduled = schedule.length > 0 ? targetForPeriod(schedule, input.target ?? "", input.periodEnd) : null;
  const useSchedule = scheduled?.source === "SCHEDULE";
  const total = semantics.aggregation === "SUM" && semantics.reportingBasis !== "CUMULATIVE";
  if (total && !useSchedule) return NO("A total is judged against the target due by the end of this period; set a target schedule to see it.");
  const target = useSchedule ? scheduled!.target : input.target;
  if (blank(target)) return NO("There is no target to compare with.");
  const compared = total ? input.cumulativeValue : input.periodValue;
  if (blank(compared)) return NO(total ? "No cumulative figure has been entered, so there is nothing to compare." : "No value has been entered yet.");
  const evaluation = evaluatePerformance({ value: compared!, baseline: input.baseline ?? "", target, semantics });
  if (evaluation.type === "NEUTRAL") return NO(evaluation.detail);
  const variance = varianceAgainst(compared, target);
  return {
    light: evaluation.type === "POSITIVE" ? "MET" : "BELOW",
    target: target!, compared: compared!.trim(),
    ...(variance && variance.percent !== null ? { variance: describeVariance(variance) } : {}),
    note: evaluation.type === "POSITIVE"
      ? `${compared!.trim()} against a target of ${target}: met or beaten.`
      : `${compared!.trim()} against a target of ${target}: below target.`,
  };
}

export const STOPLIGHT_LABEL: Readonly<Record<StoplightLight, string>> = {
  MET: "Target met",
  BELOW: "Below target",
  NONE: "Not judged",
};
