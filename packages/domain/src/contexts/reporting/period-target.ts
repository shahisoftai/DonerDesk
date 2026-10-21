import type { TargetSchedule } from "../logframe/target-schedule.js";
import { targetForPeriod, varianceAgainst } from "../logframe/target-schedule.js";
import { evaluatePerformance } from "./indicator-calculator.js";
import { isReportedFinding, type VerifiedFinding } from "./verified-finding.js";

/**
 * Judges a finding against the target scheduled for its period instead of the project's final target.
 * A schedule holds cumulative targets, so a period total of a SUM indicator is compared through its cumulative figure; with no
 * cumulative figure the finding is left as it was (a missing value is never read as 0). Without a schedule entry for the period
 * the finding is returned unchanged.
 */
export function withPeriodTarget(finding: VerifiedFinding, schedule: TargetSchedule, periodEnd: string): VerifiedFinding {
  if (schedule.length === 0) return finding;
  const scheduled = targetForPeriod(schedule, finding.target ?? "", periodEnd);
  if (scheduled.source !== "SCHEDULE" || scheduled.asOf === undefined) return finding;
  const periodTarget = { target: scheduled.target, asOf: scheduled.asOf };
  const semantics = finding.semantics;
  if (!semantics || !isReportedFinding(finding)) return { ...finding, periodTarget };
  const periodTotalOfASum = semantics.aggregation === "SUM" && semantics.reportingBasis !== "CUMULATIVE";
  const compared = periodTotalOfASum ? finding.cumulativeValue : finding.value;
  if (compared === undefined || compared.trim() === "") return { ...finding, periodTarget };
  const variance = varianceAgainst(compared, scheduled.target);
  return {
    ...finding,
    periodTarget,
    ...(variance ? { variance } : {}),
    performanceEvaluation: evaluatePerformance({ value: compared, baseline: finding.baseline, target: scheduled.target, semantics }),
  };
}
