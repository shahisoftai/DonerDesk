import type { ReportTypeRule } from "@donordesk/domain";
import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";

export const CADENCE_LABEL = {
  MONTHLY: "Every month",
  QUARTERLY: "Every three months",
  SEMI_ANNUAL: "Every six months",
  ANNUAL: "Once a year",
} as const;
export const CADENCES = Object.keys(CADENCE_LABEL) as Array<keyof typeof CADENCE_LABEL>;

export const REPORT_TYPE_LABEL: Record<string, string> = {
  MONTHLY: "Monthly report",
  QUARTERLY: "Quarterly report",
  SEMI_ANNUAL: "Semi-annual report",
  ANNUAL: "Annual report",
  FINAL: "Final report",
  ACTIVITY: "Activity report",
  SITUATION: "Situation report",
  CUSTOM: "Other report",
};
export const REPORT_TYPES = Object.keys(REPORT_TYPE_LABEL);
export const reportTypeLabel = (type: string): string => REPORT_TYPE_LABEL[type] ?? type;

/** The kinds of report not yet listed, in the order they are offered. */
export const addableTypes = (rules: readonly ReportTypeRule[]): string[] => REPORT_TYPES.filter((t) => !rules.some((r) => r.reportType === t));

/** The rules with one kind of report added (empty) or changed; the others are left as they are. */
export function upsertRule(rules: readonly ReportTypeRule[], reportType: string, patch: Partial<ReportTypeRule> = {}): ReportTypeRule[] {
  const existing = rules.find((r) => r.reportType === reportType);
  if (!existing) return [...rules, { reportType, template: "BUILT_IN", dueDaysAfterEnd: null, ...patch }];
  return rules.map((r) => (r.reportType === reportType ? { ...r, ...patch } : r));
}

export const removeRule = (rules: readonly ReportTypeRule[], reportType: string): ReportTypeRule[] => rules.filter((r) => r.reportType !== reportType);

/** What a rule still lacks, in words (empty when it is complete). */
export function ruleGaps(rule: ReportTypeRule): string[] {
  return [
    ...(rule.template ? [] : ["a layout"]),
    ...(rule.dueDaysAfterEnd === null ? ["a due date"] : []),
  ];
}

/** "2026-04-30" -> "30 Apr 2026", the same in every browser. */
export function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}

export const SHOWN_PERIODS = 12;

/** The first periods to draw, and how many are left out of the list. */
export function shownPeriods(view: SetupDraftView): { rows: SetupDraftView["timeline"]["periods"]; hidden: number } {
  const all = view.timeline.periods;
  return { rows: all.slice(0, SHOWN_PERIODS), hidden: Math.max(0, all.length - SHOWN_PERIODS) };
}
