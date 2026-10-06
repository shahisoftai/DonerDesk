import type { ActivityStatus } from "./activity-update.js";

/**
 * What may happen to an activity record, as a table: the aggregate checks it for every status change, and the
 * UI asks the same function which buttons to offer, so a button and a refusal cannot disagree.
 */
export type ActivityAction = "SUBMIT" | "ACCEPT" | "REQUEST_REVISION" | "REJECT" | "EDIT" | "WITHDRAW" | "RESTORE";

const ALL: ActivityStatus[] = ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "ACCEPTED", "REJECTED", "WITHDRAWN"];

export const ACTIVITY_TRANSITIONS: Readonly<Record<ActivityAction, { from: ReadonlyArray<ActivityStatus>; to?: ActivityStatus; refusal: string }>> = {
  SUBMIT: { from: ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "REJECTED"], to: "SUBMITTED", refusal: "This activity cannot be submitted in its current state" },
  ACCEPT: { from: ["SUBMITTED"], to: "ACCEPTED", refusal: "Only submitted activities can be accepted" },
  REQUEST_REVISION: { from: ALL.filter((s) => s !== "WITHDRAWN"), to: "NEEDS_REVISION", refusal: "A withdrawn activity cannot be sent back for revision" },
  REJECT: { from: ALL.filter((s) => s !== "WITHDRAWN"), to: "REJECTED", refusal: "A withdrawn activity cannot be rejected" },
  EDIT: { from: ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "REJECTED"], refusal: "Only an activity that is not accepted or withdrawn can be edited" },
  WITHDRAW: { from: ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "REJECTED"], to: "WITHDRAWN", refusal: "Only an activity that is not accepted can be withdrawn" },
  RESTORE: { from: ["WITHDRAWN"], to: "SUBMITTED", refusal: "Only a withdrawn activity can be restored" },
};

export function canApplyActivityAction(status: ActivityStatus, action: ActivityAction): boolean {
  return ACTIVITY_TRANSITIONS[action].from.includes(status);
}

/** The status an action leads to (EDIT leaves the status as it is). */
export function activityStatusAfter(status: ActivityStatus, action: ActivityAction): ActivityStatus {
  return ACTIVITY_TRANSITIONS[action].to ?? status;
}

/** A record that still needs someone's attention. Accepted records are done; withdrawn ones are out of the report. */
export function isOpenActivity(status: ActivityStatus): boolean {
  return status !== "ACCEPTED" && status !== "WITHDRAWN";
}

const NOTE_MARKER = /\n\n\[(Reviewer note|Rejected)\]: ([\s\S]*?)(?=\n\n\[(?:Reviewer note|Rejected)\]: |$)/g;

/**
 * A reviewer's note is stored at the end of the summary. This separates it again, so the form can show the note
 * beside the text and the note never ends up in a report.
 */
export function splitReviewerNotes(summary: string): { summary: string; notes: string[] } {
  const notes: string[] = [];
  const cleaned = summary.replace(NOTE_MARKER, (_m, _label: string, text: string) => {
    notes.push(text.trim());
    return "";
  });
  return { summary: cleaned.trimEnd(), notes };
}
