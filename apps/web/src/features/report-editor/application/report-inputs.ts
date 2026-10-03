/**
 * What a report is written from, as rows for the workspace's input panels
 * (GenerateLaunchCard, ReportInputsCard). Pure so both panels say the same
 * thing and the rules are unit-tested.
 *
 * Counts come from the period's indicator rows, which the API already scopes to
 * the report (an activity report: its activities' indicators; a situation
 * report: none). An indicator with no value entered is "not entered", never
 * "verified".
 */

export interface InputIndicatorRow {
  update: { verificationStatus: string } | null;
}

/** Activity/situation reports: the activities the report covers. */
export interface ReportScopeInfo {
  reportType: string;
  activityCount?: number;
  acceptedActivityCount?: number;
}

export interface ReportInputRow {
  key: "activities" | "indicators" | "story" | "evidence";
  label: string;
  value: string;
  ok: boolean;
  /** What is missing, in plain words (absent when nothing is). */
  gap?: string;
  href: string;
  action: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function summarizeIndicators(rows: ReadonlyArray<InputIndicatorRow>) {
  const entered = rows.filter((r) => r.update);
  const verified = entered.filter((r) => r.update!.verificationStatus === "VERIFIED").length;
  return { total: rows.length, entered: entered.length, verified, unverified: entered.length - verified, notEntered: rows.length - entered.length };
}

export function buildReportInputRows(input: {
  indicators: ReadonlyArray<InputIndicatorRow>;
  scope?: ReportScopeInfo;
  storyAnswered: number;
  evidenceCount: number;
  inputsHref: string;
  activitiesHref: string;
}): ReportInputRow[] {
  const reportType = input.scope?.reportType ?? "";
  const rows: ReportInputRow[] = [];

  if (reportType === "ACTIVITY") {
    const count = input.scope?.activityCount ?? 0;
    const accepted = input.scope?.acceptedActivityCount ?? 0;
    rows.push({
      key: "activities",
      label: "Activities",
      value: `${count} selected · ${accepted} accepted`,
      ok: count > 0 && accepted === count,
      gap: count === 0 ? "This report has no activities." : accepted < count ? "Accept the activity records this report rests on." : undefined,
      href: input.activitiesHref,
      action: "Review activities",
    });
  } else if (reportType === "SITUATION") {
    const count = input.scope?.activityCount ?? 0;
    rows.push({
      key: "activities",
      label: "Activities in this window",
      value: String(count),
      ok: count > 0,
      gap: count === 0 ? "No activities are dated inside this report's window." : undefined,
      href: input.activitiesHref,
      action: "View activities",
    });
  }

  // A situation report carries no indicator results.
  if (reportType !== "SITUATION") {
    const s = summarizeIndicators(input.indicators);
    const href = `${input.inputsHref}?tab=indicators`;
    if (reportType === "ACTIVITY" && s.total === 0) {
      rows.push({ key: "indicators", label: "Linked indicators", value: "none linked", ok: true, href, action: "Review data" });
    } else if (s.total === 0) {
      rows.push({ key: "indicators", label: "Indicator values", value: "none defined", ok: false, gap: "This project has no indicators yet.", href, action: "Review data" });
    } else if (s.entered === 0) {
      rows.push({
        key: "indicators",
        label: reportType === "ACTIVITY" ? "Linked indicators" : "Indicator values",
        value: "none entered",
        ok: false,
        gap: "Reports need this period's indicator figures.",
        href,
        action: "Enter data",
      });
    } else {
      rows.push({
        key: "indicators",
        label: reportType === "ACTIVITY" ? "Linked indicators" : "Indicator values",
        value: `${s.verified} of ${s.entered} verified${s.notEntered > 0 ? ` · ${s.notEntered} not entered` : ""}`,
        ok: s.unverified === 0 && s.notEntered === 0,
        gap:
          s.notEntered > 0
            ? `${plural(s.notEntered, "indicator")} ${s.notEntered === 1 ? "has" : "have"} no value for this period.`
            : s.unverified > 0
              ? "Unverified figures will be marked in the report."
              : undefined,
        href,
        action: s.notEntered > 0 ? "Enter data" : "Review data",
      });
    }
  }

  rows.push({
    key: "story",
    label: "Story answers",
    value: `${input.storyAnswered} of 5 answered`,
    ok: input.storyAnswered > 0,
    gap: input.storyAnswered === 0 ? "Reports read better when you explain challenges and changes." : undefined,
    href: `${input.inputsHref}?tab=story`,
    action: input.storyAnswered === 0 ? "Answer now" : "Edit story",
  });
  rows.push({
    key: "evidence",
    label: "Evidence",
    value: plural(input.evidenceCount, "file"),
    ok: input.evidenceCount > 0,
    gap: input.evidenceCount === 0 ? "Without evidence the AI cannot back up what it writes." : undefined,
    href: `${input.inputsHref}?tab=import`,
    action: input.evidenceCount === 0 ? "Add evidence" : "Add more",
  });
  return rows;
}
