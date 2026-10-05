import type { ActivityUpdate, Indicator, ChecklistItemType, ReportingPeriod, Severity, VerifiedFinding } from "@donordesk/domain";
import type { FinanceStatus } from "./finance-inputs.js";
import { effectiveIndicatorSemantics, missingCumulativeFields, comparableReportTypes, periodComparability, selectComparablePeriods } from "@donordesk/domain";

/** A checklist item the detector proposes for a reporting period. */
export interface ChecklistSuggestion {
  type: ChecklistItemType;
  title: string;
  description: string;
  severity: Severity;
  relatedEntityType?: string | undefined;
  relatedEntityId?: string | undefined;
}

/** An activity report covers named activities: each one must carry evidence. */
export function activityEvidenceItems(activities: ReadonlyArray<ActivityUpdate>): ChecklistSuggestion[] {
  return activities
    .filter((a) => a.attachedEvidenceIds.length === 0)
    .map((a) => ({
      type: "MISSING_EVIDENCE" as const,
      title: `Evidence attached to "${a.activityTitle}"`,
      description: "This activity is covered by the report but has no supporting evidence (photos, attendance sheets, field reports) attached.",
      severity: "HIGH" as const,
      relatedEntityType: "activity",
      relatedEntityId: a.id,
    }));
}

/** An activity report should rest on accepted activity records. */
export function activityRecordAcceptedItems(activities: ReadonlyArray<ActivityUpdate>): ChecklistSuggestion[] {
  return activities
    .filter((a) => a.status !== "ACCEPTED")
    .map((a) => ({
      type: "ACTIVITY_RECORD_ACCEPTED" as const,
      title: `Activity record accepted: "${a.activityTitle}"`,
      description: "An activity report should rest on accepted activity records. Review and accept this activity update before submitting.",
      severity: "MEDIUM" as const,
      relatedEntityType: "activity",
      relatedEntityId: a.id,
    }));
}

/**
 * Reports on progress since the project started (semi-annual, annual, final) need
 * a baseline, a target and a verified cumulative figure for every indicator that
 * can be aggregated across periods. Ratios and percentages need their numerator
 * and denominator and are not reported cumulatively, so they raise nothing.
 */
export function cumulativeDataItems(findings: ReadonlyArray<VerifiedFinding>, reportType: string): ChecklistSuggestion[] {
  const severity: Severity = reportType === "FINAL" ? "HIGH" : "MEDIUM";
  const items: ChecklistSuggestion[] = [];
  for (const f of findings) {
    const aggregation = f.semantics?.aggregation;
    if (aggregation === "RATIO" || aggregation === "PERCENTAGE") continue;
    const missing = missingCumulativeFields({ baseline: f.baseline, target: f.target, hasVerifiedCumulative: Boolean(f.lifeOfProject) });
    if (missing.length === 0) continue;
    items.push({
      type: "CUMULATIVE_DATA_COMPLETE",
      title: `Cumulative data for ${f.indicatorCode}`,
      description: `${f.indicatorCode}${f.indicatorName ? ` (${f.indicatorName})` : ""} is missing its ${missing.join(", ")}, so progress since the project started cannot be reported.`,
      severity,
      relatedEntityType: "indicator",
      relatedEntityId: f.indicatorId,
    });
  }
  return items;
}

/** What the "previous report" check needs to know about an earlier period. */
export interface PriorPeriodStatus {
  period: Pick<ReportingPeriod, "id" | "reportType" | "duration">;
  /** Whether the period has an approved or submitted report. */
  finished: boolean;
}

/**
 * A report that builds on an earlier one (a situation follow-up, a half-year, an
 * annual or a final report) should compare with a finished report. Raised only
 * when comparable earlier reports exist and none is approved or submitted; a
 * first report has nothing to compare with and raises nothing.
 */
export function priorReportItem(
  period: Pick<ReportingPeriod, "reportType" | "scope">,
  candidates: ReadonlyArray<PriorPeriodStatus>,
): ChecklistSuggestion | undefined {
  const comparability = periodComparability(period.reportType, period.scope);
  if (!comparability || comparability.primary.length === 0) return undefined;
  const wanted = new Set(comparableReportTypes(comparability));
  const eligible = candidates.filter((c) => wanted.has(c.period.reportType));
  const chosen = selectComparablePeriods(eligible.map((c) => ({ ...c, reportType: c.period.reportType })), comparability, 1);
  if (chosen.length === 0 || chosen.some((c) => c.finished)) return undefined;
  const label = period.reportType === "SITUATION" ? "previous situation report on this event" : "previous report";
  return {
    type: "PRIOR_REPORT_LINKED",
    title: `Previous report approved`,
    description: `The ${label} is not approved or submitted yet. Approve it first so this report's comparison rests on a finished report.`,
    severity: "MEDIUM",
    relatedEntityType: "reporting_period",
    relatedEntityId: chosen[0]!.period.id,
  };
}

/**
 * A report whose project uses financial figures needs them entered and then
 * verified before the financial section can report them. Raised once per concern
 * (`finance:entry`, `finance:verification`) and only while it is unresolved.
 */
export function financeItems(status: FinanceStatus): ChecklistSuggestion[] {
  if (status === "MISSING") {
    return [{
      type: "FINANCE_FIGURES_PROVIDED",
      title: "Financial figures entered",
      description: "Enter or import this period's budget and expenditure so the financial section can report real figures instead of saying they are reported separately.",
      severity: "MEDIUM",
      relatedEntityType: "finance",
      relatedEntityId: "entry",
    }];
  }
  if (status === "UNVERIFIED") {
    return [{
      type: "FINANCE_FIGURES_PROVIDED",
      title: "Financial figures verified",
      description: "The financial figures are entered but not verified yet. Only verified figures are used in the report: review and verify them.",
      severity: "HIGH",
      relatedEntityType: "finance",
      relatedEntityId: "verification",
    }];
  }
  return [];
}

/**
 * An indicator whose calculation is still only a suggestion ("requires review") makes the report
 * describe it without saying whether it is on track. One item per indicator; it is closed again
 * once the calculation is confirmed (see `confirmedSemanticsIndicatorIds`).
 */
export function semanticsReviewItems(indicators: ReadonlyArray<Pick<Indicator, "id" | "code" | "name" | "type" | "unit" | "semantics">>): ChecklistSuggestion[] {
  return indicators
    .filter((i) => effectiveIndicatorSemantics(i).status === "REQUIRES_REVIEW")
    .map((i) => ({
      type: "INDICATOR_SEMANTICS_UNREVIEWED" as const,
      title: `Confirm how ${i.code} is calculated`,
      description: `${i.code}${i.name ? ` (${i.name})` : ""} uses a suggested calculation that nobody has confirmed. Confirm it, or choose another, so the report can say whether the indicator is on track.`,
      severity: "MEDIUM" as const,
      relatedEntityType: "indicator",
      relatedEntityId: i.id,
    }));
}

/** Ids of indicators whose calculation is confirmed (or inferred with confidence): their open review items are stale. */
export function confirmedSemanticsIndicatorIds(indicators: ReadonlyArray<Pick<Indicator, "id" | "name" | "type" | "unit" | "semantics">>): Set<string> {
  return new Set(indicators.filter((i) => effectiveIndicatorSemantics(i).status !== "REQUIRES_REVIEW").map((i) => i.id));
}
