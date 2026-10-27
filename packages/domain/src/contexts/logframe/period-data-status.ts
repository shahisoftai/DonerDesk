/**
 * Where a reporting period's indicator data stands (Phase 33.4): derived from the status of the values recorded
 * for it, never stored, so it can never disagree with them.
 *
 *   NO_DATA      nothing recorded yet
 *   IN_PROGRESS  at least one value is still a draft (being entered)
 *   RETURNED     a reviewer sent at least one value back or rejected it; it needs the person's attention
 *   SUBMITTED    every value is handed in and at least one still waits for review
 *   VERIFIED     every value is verified
 *
 * RETURNED outranks IN_PROGRESS (the person must act on what came back), and a mix of drafts and handed-in values is
 * IN_PROGRESS: the data is not complete until the last draft is submitted. Pure.
 */
export type PeriodDataStatus = "NO_DATA" | "IN_PROGRESS" | "RETURNED" | "SUBMITTED" | "VERIFIED";

export const PERIOD_DATA_STATUS_LABEL: Readonly<Record<PeriodDataStatus, string>> = {
  NO_DATA: "Nothing recorded yet",
  IN_PROGRESS: "Being entered",
  RETURNED: "Sent back for changes",
  SUBMITTED: "Waiting for review",
  VERIFIED: "Verified",
};

export interface PeriodDataSummary {
  status: PeriodDataStatus;
  total: number;
  drafts: number;
  submitted: number;
  returned: number;
  verified: number;
}

export function summarizePeriodData(statuses: readonly string[]): PeriodDataSummary {
  const count = (...of: string[]) => statuses.filter((s) => of.includes(s)).length;
  const drafts = count("DRAFT");
  const submitted = count("SUBMITTED");
  const returned = count("NEEDS_CORRECTION", "REJECTED");
  const verified = count("VERIFIED");
  const total = drafts + submitted + returned + verified;
  let status: PeriodDataStatus;
  if (total === 0) status = "NO_DATA";
  else if (returned > 0) status = "RETURNED";
  else if (drafts > 0) status = "IN_PROGRESS";
  else if (submitted > 0) status = "SUBMITTED";
  else status = "VERIFIED";
  return { status, total, drafts, submitted, returned, verified };
}

/** Values the person can hand in: drafts and values sent back (after they have been corrected). */
export const SUBMITTABLE_STATUSES: readonly string[] = ["DRAFT", "NEEDS_CORRECTION"];

/** One sentence for the screen, from the summary. */
export function describePeriodData(summary: PeriodDataSummary): string {
  const { status, total, drafts, submitted, returned, verified } = summary;
  const values = (n: number) => `${n} ${n === 1 ? "value" : "values"}`;
  switch (status) {
    case "NO_DATA":
      return "No values have been recorded for this period yet.";
    case "IN_PROGRESS":
      return `${values(drafts)} still being entered${submitted + verified > 0 ? `; ${values(submitted + verified)} already handed in` : ""}. Submit when they are complete.`;
    case "RETURNED":
      return `${values(returned)} sent back for changes. Correct ${returned === 1 ? "it" : "them"} and submit again.`;
    case "SUBMITTED":
      return `${values(total)} handed in${verified > 0 ? ` (${verified} already verified)` : ""}, waiting for review.`;
    case "VERIFIED":
      return `All ${values(total)} verified.`;
  }
}
