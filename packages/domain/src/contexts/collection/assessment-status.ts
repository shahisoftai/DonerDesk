/**
 * Where a facility stands in an assessment round (Phase 62.5): assigned, started, done or not visited with a reason. One table of
 * moves; a person may leave a facility unvisited only by saying why, and a finished one is never reopened here (review owns that).
 */
export type AssignmentStatus = "TO_DO" | "IN_PROGRESS" | "DONE" | "NOT_VISITED";
export const ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = ["TO_DO", "IN_PROGRESS", "DONE", "NOT_VISITED"];

export const ASSIGNMENT_MOVES: Readonly<Record<AssignmentStatus, readonly AssignmentStatus[]>> = {
  TO_DO: ["IN_PROGRESS", "DONE", "NOT_VISITED"],
  IN_PROGRESS: ["DONE", "NOT_VISITED", "TO_DO"],
  NOT_VISITED: ["TO_DO", "IN_PROGRESS", "DONE"],
  DONE: [],
};

export type MoveRefusal = "NOT_ALLOWED" | "REASON_NEEDED";
export function checkAssignmentMove(from: AssignmentStatus, to: AssignmentStatus, reason?: string): { ok: true } | { ok: false; refusal: MoveRefusal } {
  if (from === to || !ASSIGNMENT_MOVES[from].includes(to)) return { ok: false, refusal: "NOT_ALLOWED" };
  if (to === "NOT_VISITED" && !reason?.trim()) return { ok: false, refusal: "REASON_NEEDED" };
  return { ok: true };
}

export interface AssignmentFact { placeId: string; status: AssignmentStatus }
export interface CoverageRow { areaId: string; assigned: number; started: number; done: number; notVisited: number; toDo: number }

/**
 * Coverage by area: facilities assigned, started, done and not visited per place at some level. `areaOf` names the area a facility sits
 * in (its district); a facility with no such area is counted under "" so it is never dropped.
 */
export function coverageByArea(assignments: ReadonlyArray<AssignmentFact>, areaOf: (placeId: string) => string | undefined): CoverageRow[] {
  const rows = new Map<string, CoverageRow>();
  for (const a of assignments) {
    const id = areaOf(a.placeId) ?? "";
    const row = rows.get(id) ?? { areaId: id, assigned: 0, started: 0, done: 0, notVisited: 0, toDo: 0 };
    row.assigned += 1;
    if (a.status === "IN_PROGRESS") row.started += 1;
    else if (a.status === "DONE") row.done += 1;
    else if (a.status === "NOT_VISITED") row.notVisited += 1;
    else row.toDo += 1;
    rows.set(id, row);
  }
  return [...rows.values()].sort((x, y) => x.areaId.localeCompare(y.areaId));
}
