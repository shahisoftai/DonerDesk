import { describePeriodTypes, type PeriodFact } from "./period-type-rules.js";

/**
 * The guided path to a project's closing (FINAL) report: what must be true, what is still to do,
 * and where to do it. Pure; the application gathers the facts. Steps come from a rule table, so a
 * new requirement is a new entry, not a new branch.
 */

/** The fields a roll-up report needs per indicator; the same rule feeds the period checklist. */
export function missingCumulativeFields(f: { baseline?: string | undefined; target?: string | undefined; hasVerifiedCumulative: boolean }): string[] {
  const missing: string[] = [];
  if (f.baseline === undefined || f.baseline === "") missing.push("baseline");
  if (f.target === undefined || f.target === "") missing.push("project target");
  if (!f.hasVerifiedCumulative) missing.push("verified cumulative value");
  return missing;
}

export type ClosingStepStatus = "DONE" | "TODO" | "AFTER_START" | "BLOCKED";

export type ClosingActionKind = "OPEN_LOGFRAME" | "OPEN_REPORTS" | "OPEN_INPUTS" | "OPEN_ACTIVITIES" | "OPEN_TEMPLATES" | "OPEN_TEAM" | "OPEN_SETTINGS" | "START";

export interface ClosingStep {
  key: string;
  label: string;
  status: ClosingStepStatus;
  detail: string;
  action?: { kind: ClosingActionKind; label: string };
}

export interface ClosingFacts {
  projectStatus: string;
  projectStart: Date;
  projectEnd: Date;
  existing: ReadonlyArray<PeriodFact & { finished: boolean }>;
  activityCount: number;
  unacceptedActivityCount: number;
  unconfirmedCalculationCount: number;
  /** Aggregatable indicators with something missing, e.g. "O1.1 (target)". */
  cumulativeGaps: ReadonlyArray<{ code: string; missing: string[] }>;
  financeMode: "ON" | "OFF";
  /** Status of the FINAL period's finance when it exists. */
  finalFinance?: "OFF" | "MISSING" | "UNVERIFIED" | "VERIFIED";
  templateState: "NONE" | "REVIEWED" | "NOT_REVIEWED";
  /** The template the closing report will use, when there is one (named in the step so the user sees what will apply). */
  templateName?: string;
  projectManagerAssigned: boolean;
  meOfficerAssigned: boolean;
}

interface StepRule {
  key: string;
  evaluate(f: ClosingFacts): Omit<ClosingStep, "key">;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const CLOSING_STEP_RULES: ReadonlyArray<StepRule> = [
  {
    key: "calculations",
    evaluate: (f) =>
      f.unconfirmedCalculationCount === 0
        ? { label: "Indicator calculations confirmed", status: "DONE", detail: "Every indicator's calculation is confirmed." }
        : { label: "Indicator calculations confirmed", status: "TODO", detail: `${plural(f.unconfirmedCalculationCount, "indicator")} still use a suggested calculation. Confirm them so the report can say whether targets were met.`, action: { kind: "OPEN_LOGFRAME", label: "Confirm calculations" } },
  },
  {
    key: "periods",
    evaluate: (f) => {
      const open = f.existing.filter((p) => p.reportType !== "FINAL" && ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"].includes(p.reportType) && !p.finished);
      return open.length === 0
        ? { label: "Earlier reports approved", status: "DONE", detail: "Every earlier regular report is approved or submitted." }
        : { label: "Earlier reports approved", status: "TODO", detail: `${plural(open.length, "earlier report")} not approved yet. The closing report builds on them.`, action: { kind: "OPEN_REPORTS", label: "Open reports" } };
    },
  },
  {
    key: "figures",
    evaluate: (f) =>
      f.cumulativeGaps.length === 0
        ? { label: "Project-wide figures complete", status: "DONE", detail: "Every indicator has a baseline, a target and a verified cumulative value." }
        : {
            label: "Project-wide figures complete",
            status: "TODO",
            detail: `${plural(f.cumulativeGaps.length, "indicator")} missing figures: ${f.cumulativeGaps.slice(0, 5).map((g) => `${g.code} (${g.missing.join(", ")})`).join("; ")}${f.cumulativeGaps.length > 5 ? "…" : ""}.`,
            action: { kind: "OPEN_LOGFRAME", label: "Complete indicators" },
          },
  },
  {
    key: "finance",
    evaluate: (f) => {
      if (f.financeMode === "OFF") return { label: "Finance reported", status: "DONE", detail: "This project does not report finance in its reports." };
      if (!f.finalFinance) return { label: "Finance reported", status: "AFTER_START", detail: "Enter and verify the final financial figures once the closing report is started." };
      if (f.finalFinance === "VERIFIED" || f.finalFinance === "OFF") return { label: "Finance reported", status: "DONE", detail: "Financial figures are verified." };
      return { label: "Finance reported", status: "TODO", detail: f.finalFinance === "MISSING" ? "Enter the final budget and expenditure." : "Verify the financial figures; only verified figures are used.", action: { kind: "OPEN_INPUTS", label: "Open report inputs" } };
    },
  },
  {
    key: "activities",
    evaluate: (f) =>
      f.unacceptedActivityCount === 0
        ? { label: "Activities accepted", status: "DONE", detail: f.activityCount === 0 ? "No activities are recorded." : "Every recorded activity is accepted; the closing report uses accepted activities." }
        : { label: "Activities accepted", status: "TODO", detail: `${plural(f.unacceptedActivityCount, "activity record")} not accepted. A closing report only rolls up accepted activities.`, action: { kind: "OPEN_ACTIVITIES", label: "Review activities" } },
  },
  {
    key: "template",
    evaluate: (f) =>
      f.templateState === "NOT_REVIEWED"
        ? { label: "Donor template approved", status: "TODO", detail: "The donor template is not approved yet. Review and approve it, or the built-in structure is used.", action: { kind: "OPEN_TEMPLATES", label: "Open templates" } }
        : { label: "Donor template approved", status: "DONE", detail: f.templateState === "NONE" ? "No donor template: the built-in closing report structure is used. Add and approve a Final template to use the donor's own sections." : f.templateName ? `The approved template "${f.templateName}" will structure the closing report.` : "The donor template is approved." },
  },
  {
    key: "signoffs",
    evaluate: (f) => {
      const missing = [!f.projectManagerAssigned ? "project manager" : "", !f.meOfficerAssigned ? "M&E officer" : ""].filter(Boolean);
      return missing.length === 0
        ? { label: "Sign-offs assigned", status: "DONE", detail: "The project manager and M&E officer are assigned to review and approve." }
        : { label: "Sign-offs assigned", status: "TODO", detail: `Assign a ${missing.join(" and a ")} so someone can review and approve the closing report. The two roles are held by different people, so if you work alone, invite a colleague under Team first.`, action: { kind: "OPEN_SETTINGS", label: "Open project settings" } };
    },
  },
];

export interface ClosingPlan {
  /** False when the project takes no new reports; every step is then BLOCKED. */
  canStart: boolean;
  /** Why it cannot be started, and what to do. */
  blockedReason?: string;
  /** The closing report that already exists, if any. */
  existingFinalId?: string;
  suggestedPeriod?: { startDate: string; endDate: string };
  steps: ClosingStep[];
  /** Steps still to do before the report (AFTER_START ones happen once it exists). */
  todoCount: number;
}

export function planClosingReport(facts: ClosingFacts): ClosingPlan {
  const final = facts.existing.find((p) => p.reportType === "FINAL");
  const option = describePeriodTypes({
    projectStart: facts.projectStart,
    projectEnd: facts.projectEnd,
    projectStatus: facts.projectStatus,
    existing: facts.existing,
    activityCount: facts.activityCount,
  }).find((o) => o.type === "FINAL");

  const steps: ClosingStep[] = CLOSING_STEP_RULES.map((r) => ({ key: r.key, ...r.evaluate(facts) }));
  const blocked = !option?.available && !final;
  const blockedReason = final ? "A closing report already exists for this project." : blocked ? [option?.why, option?.nextAction].filter(Boolean).join(" ") : undefined;
  return {
    canStart: Boolean(option?.available) && !final,
    ...(blockedReason ? { blockedReason } : {}),
    ...(final ? { existingFinalId: final.id } : {}),
    ...(option?.suggestedDates ? { suggestedPeriod: option.suggestedDates } : {}),
    steps: blocked ? steps.map((s) => ({ ...s, status: "BLOCKED" as const })) : steps,
    todoCount: steps.filter((s) => s.status === "TODO").length,
  };
}
