import type { AssignmentView } from "@/lib/server/schemas-assessments";

/**
 * What a field worker still has to do from the facilities given to them (Phase 63). Pure: the home screen asks for the queue and the
 * summary line, and nothing here knows which sector or form it is. Started visits come first (they are half done), then the earliest
 * due day, then the name, so the order is the same on every device.
 */
type Open = AssignmentView & { status: "TO_DO" | "IN_PROGRESS" };

const isOpen = (a: AssignmentView): a is Open => a.status === "TO_DO" || a.status === "IN_PROGRESS";

export function openAssignments(all: readonly AssignmentView[]): Open[] {
  return all.filter(isOpen).sort((a, b) => {
    if (a.status !== b.status) return a.status === "IN_PROGRESS" ? -1 : 1;
    if (a.dueOn !== b.dueOn) return a.dueOn === undefined ? 1 : b.dueOn === undefined ? -1 : a.dueOn < b.dueOn ? -1 : 1;
    return a.placeName.localeCompare(b.placeName);
  });
}

export interface AssignmentSummary { toDo: number; started: number; done: number; notVisited: number }

export function summariseAssignments(all: readonly AssignmentView[]): AssignmentSummary {
  const count = (s: AssignmentView["status"]) => all.filter((a) => a.status === s).length;
  return { toDo: count("TO_DO"), started: count("IN_PROGRESS"), done: count("DONE"), notVisited: count("NOT_VISITED") };
}

/** One tap opens the form with this facility already chosen (the fill tab starts it at once). */
export function assignmentHref(a: Pick<AssignmentView, "projectId" | "formId" | "placeId">): string {
  return `/projects/${a.projectId}/forms/${a.formId}?place=${encodeURIComponent(a.placeId)}`;
}
