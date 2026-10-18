/**
 * Everything a person is responsible for, as one shape: a planned activity they lead, a request made of them, a checklist item
 * assigned to them, a report they own, and the reviews they are asked to do because of their role. A read model, not a table.
 * Every source returns this same shape with the same meaning of `dueDate`, `state` and `href`, so My Work, the Team tab and the
 * reminders can treat them alike.
 */
import { addDays, compareDates, type PlainDate } from "../workplan/plain-date.js";
import { startOfWeekMonday } from "./week.js";

export type AssignmentKind = "PLAN_ITEM" | "TASK" | "CHECKLIST_ITEM" | "REPORT_DEADLINE" | "EVIDENCE_REVIEW" | "ACTIVITY_REVIEW" | "ACTIVITY_FIX" | "INDICATOR_VALUE";
export const ASSIGNMENT_KIND_KEYS: AssignmentKind[] = ["PLAN_ITEM", "TASK", "CHECKLIST_ITEM", "REPORT_DEADLINE", "EVIDENCE_REVIEW", "ACTIVITY_REVIEW", "ACTIVITY_FIX", "INDICATOR_VALUE"];

export interface AssignmentKindSpec {
  label: string;
  /** Items that arrive because of the person's role, not because someone named them. */
  becauseOfRole: boolean;
  /** "because you approve" */
  because?: string;
}

export const ASSIGNMENT_KINDS: Readonly<Record<AssignmentKind, AssignmentKindSpec>> = {
  PLAN_ITEM: { label: "Planned activity", becauseOfRole: false },
  TASK: { label: "Request", becauseOfRole: false },
  CHECKLIST_ITEM: { label: "Compliance item", becauseOfRole: false },
  REPORT_DEADLINE: { label: "Report", becauseOfRole: false },
  EVIDENCE_REVIEW: { label: "File to check", becauseOfRole: true, because: "because you verify files" },
  ACTIVITY_REVIEW: { label: "Completed activity to review", becauseOfRole: true, because: "because you approve" },
  ACTIVITY_FIX: { label: "Completed activity to fix", becauseOfRole: false },
  INDICATOR_VALUE: { label: "Indicator value", becauseOfRole: false },
};

export type AssignmentState = "OPEN" | "LATE";

export interface Assignment {
  /** Stable across reads (kind + the thing's id), so lists can be merged and deduplicated. */
  key: string;
  kind: AssignmentKind;
  projectId: string;
  projectTitle: string;
  title: string;
  /** Who it is for. */
  assigneeId: string;
  /** A plain calendar day; absent when nothing says when. */
  dueDate?: PlainDate;
  state: AssignmentState;
  urgent: boolean;
  /** Where to act on it. Always an app path. */
  href: string;
  /** Lower is more urgent inside a group (the order My Work always used). */
  urgency: number;
  /** For role-based items: why the person sees it ("because you approve"). */
  because?: string;
  /** For requests: who asked. */
  askedById?: string;
  /** A person closes this one by hand ("Mark done"); everything else closes itself from the records. */
  manual?: boolean;
}

export type DueGroupKey = "LATE" | "TODAY" | "THIS_WEEK" | "LATER" | "NO_DATE";
export const DUE_GROUP_ORDER: DueGroupKey[] = ["LATE", "TODAY", "THIS_WEEK", "LATER", "NO_DATE"];
export const DUE_GROUP_LABEL: Readonly<Record<DueGroupKey, string>> = { LATE: "Late", TODAY: "Today", THIS_WEEK: "This week", LATER: "Later", NO_DATE: "No date" };

export interface DueGroup<T extends Assignment = Assignment> { key: DueGroupKey; label: string; items: T[] }

export function dueGroupOf(a: Pick<Assignment, "dueDate" | "state">, today: PlainDate): DueGroupKey {
  if (a.state === "LATE") return "LATE";
  if (!a.dueDate) return "NO_DATE";
  if (compareDates(a.dueDate, today) < 0) return "LATE";
  if (a.dueDate === today) return "TODAY";
  return compareDates(a.dueDate, addDays(startOfWeekMonday(today), 6)) <= 0 ? "THIS_WEEK" : "LATER";
}

const byImportance = (a: Assignment, b: Assignment) =>
  Number(b.urgent) - Number(a.urgent) || a.urgency - b.urgency || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.title.localeCompare(b.title) || a.key.localeCompare(b.key);

/** Late / Today / This week / Later / No date, empty groups left out; inside a group: urgent first, then the usual urgency order. */
export function groupByDue<T extends Assignment>(assignments: ReadonlyArray<T>, today: PlainDate): DueGroup<T>[] {
  return DUE_GROUP_ORDER.map((key) => ({
    key, label: DUE_GROUP_LABEL[key],
    items: assignments.filter((a) => dueGroupOf(a, today) === key).sort(byImportance),
  })).filter((g) => g.items.length > 0);
}

/** The same assignment from two sources is shown once. */
export function dedupeAssignments<T extends Assignment>(assignments: ReadonlyArray<T>): T[] {
  const seen = new Set<string>();
  return assignments.filter((a) => (seen.has(a.key) ? false : (seen.add(a.key), true)));
}

export interface TeamWorkRow { assigneeId: string; open: number; late: number; dueThisWeek: number }

/** People × counts for the Team tab. Role-based items are left out: they are not anyone's named responsibility. */
export function teamWorkSummary(assignments: ReadonlyArray<Assignment>, today: PlainDate): TeamWorkRow[] {
  const rows = new Map<string, TeamWorkRow>();
  for (const a of assignments) {
    if (ASSIGNMENT_KINDS[a.kind].becauseOfRole) continue;
    const row = rows.get(a.assigneeId) ?? { assigneeId: a.assigneeId, open: 0, late: 0, dueThisWeek: 0 };
    const group = dueGroupOf(a, today);
    row.open += 1;
    if (group === "LATE") row.late += 1;
    if (group === "TODAY" || group === "THIS_WEEK") row.dueThisWeek += 1;
    rows.set(a.assigneeId, row);
  }
  return [...rows.values()].sort((a, b) => b.late - a.late || b.dueThisWeek - a.dueThisWeek || b.open - a.open || a.assigneeId.localeCompare(b.assigneeId));
}
