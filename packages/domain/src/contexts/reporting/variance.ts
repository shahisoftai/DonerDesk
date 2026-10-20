import type { VerifiedFinding } from "./verified-finding.js";
import { isReportedFinding } from "./verified-finding.js";
import { isRateIndicator } from "./export-indicator-columns.js";

/**
 * How far from its target an indicator may finish before the report must say why. A closing report that quietly shows
 * 54% of a target (or a cost 40% over) with no explanation raises no question until the donor asks it.
 */
export const VARIANCE_THRESHOLD = 0.2;

/** Only the closing report is judged against the whole-project target; earlier reports have no phased target to miss. */
export const VARIANCE_REPORT_TYPES: ReadonlySet<string> = new Set(["FINAL"]);

function toNumber(text: string | undefined): number | null {
  if (text === undefined) return null;
  const n = Number(text.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * The indicators of a closing report whose life-of-project value is unfavourably more than `threshold` away from the
 * target, in the direction the indicator says is better. Rates, indicators without a resolved direction, and ones with no
 * figure or no target are never judged (nothing to compare, or no right to call it a miss).
 */
export function offTargetFindings(findings: ReadonlyArray<VerifiedFinding>, reportType: string, threshold = VARIANCE_THRESHOLD): VerifiedFinding[] {
  if (!VARIANCE_REPORT_TYPES.has(reportType)) return [];
  return findings.filter((f) => {
    if (!isReportedFinding(f) || !f.lifeOfProject) return false;
    if (isRateIndicator({ type: f.indicatorType ?? "", unit: f.unit })) return false;
    const direction = f.semantics?.direction;
    if (f.semantics?.status === "REQUIRES_REVIEW" || (direction !== "HIGHER_IS_BETTER" && direction !== "LOWER_IS_BETTER")) return false;
    const target = toNumber(f.target);
    const value = toNumber(f.lifeOfProject.value);
    if (target === null || value === null || target === 0) return false;
    return direction === "HIGHER_IS_BETTER" ? value < target * (1 - threshold) : value > target * (1 + threshold);
  });
}
