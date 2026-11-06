/**
 * The kinds of request one person can make of another, as one exhaustive table (add a kind = add a row). A person never picks a
 * kind from a list: the button they pressed sets it ("Ask for a file"). Each kind says what it is about, what the person asked
 * must be allowed to do, and whether it closes itself from data (STATE) or by a person (MANUAL).
 */
import type { Permission } from "../../policies/permissions.js";
import type { PlainDate } from "../workplan/plain-date.js";
import { addDays } from "../workplan/plain-date.js";

export type TaskKind = "RECORD_ACTIVITY" | "PROVIDE_EVIDENCE" | "ENTER_INDICATOR_VALUE" | "REVIEW_RECORD" | "OTHER";
export const TASK_KIND_KEYS: TaskKind[] = ["RECORD_ACTIVITY", "PROVIDE_EVIDENCE", "ENTER_INDICATOR_VALUE", "REVIEW_RECORD", "OTHER"];

export type TaskSubjectType = "plannedActivity" | "activityUpdate" | "indicator";
export type TaskCompletion = "STATE" | "MANUAL";

export interface TaskKindSpec {
  /** The button the person pressed. */
  button: string;
  /** What a request of this kind may be about. Empty means it is about nothing in particular. */
  subjects: ReadonlyArray<TaskSubjectType>;
  /** An indicator request also names the reporting period the value is for. */
  needsPeriod: boolean;
  /** What the person asked must be allowed to do, or the request could never be met. */
  requires: Permission;
  completion: TaskCompletion;
  /** Days after the suggested start (or the activity's end) that the request is due. */
  dueAfterDays: number;
  /** "Add completed activity: Outreach visits" */
  title(subjectTitle: string | undefined): string;
}

export const TASK_KINDS: Readonly<Record<TaskKind, TaskKindSpec>> = {
  RECORD_ACTIVITY: {
    button: "Ask for completed activity", subjects: ["plannedActivity"], needsPeriod: false, requires: "activity.create", completion: "STATE", dueAfterDays: 3,
    title: (s) => `Add completed activity${s ? `: ${s}` : ""}`,
  },
  PROVIDE_EVIDENCE: {
    button: "Ask for a file", subjects: ["plannedActivity", "activityUpdate", "indicator"], needsPeriod: false, requires: "evidence.upload", completion: "STATE", dueAfterDays: 3,
    title: (s) => `Add a file${s ? `: ${s}` : ""}`,
  },
  ENTER_INDICATOR_VALUE: {
    button: "Ask for this value", subjects: ["indicator"], needsPeriod: true, requires: "indicator.update", completion: "STATE", dueAfterDays: 3,
    title: (s) => `Enter the value${s ? `: ${s}` : ""}`,
  },
  REVIEW_RECORD: {
    button: "Ask for a review", subjects: ["activityUpdate"], needsPeriod: false, requires: "activity.approve", completion: "STATE", dueAfterDays: 3,
    title: (s) => `Review${s ? `: ${s}` : " a completed activity"}`,
  },
  OTHER: {
    button: "Ask someone…", subjects: [], needsPeriod: false, requires: "project.view", completion: "MANUAL", dueAfterDays: 3,
    title: (s) => s ?? "Request",
  },
};

/** The due date offered in the dialog (always editable): an activity's end + 3 days, otherwise today + 3 days. */
export function suggestTaskDueDate(kind: TaskKind, input: { today: PlainDate; subjectEnd?: PlainDate }): PlainDate {
  const days = TASK_KINDS[kind].dueAfterDays;
  const base = input.subjectEnd && input.subjectEnd > input.today ? input.subjectEnd : input.today;
  return addDays(base, days);
}
