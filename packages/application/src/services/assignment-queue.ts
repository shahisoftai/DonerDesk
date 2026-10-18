import { dedupeAssignments, ok, type Assignment, type DomainError, type Result } from "@donordesk/domain";
import type { AssignmentQuery, IAssignmentSource } from "../ports/tasks.js";

/** Composes the assignment sources into one list: each asked once, merged, the same thing shown once. */
export class AssignmentQueue {
  constructor(private readonly sources: ReadonlyArray<IAssignmentSource>) {}

  async list(query: AssignmentQuery): Promise<Result<Assignment[], DomainError>> {
    const lists = await Promise.all(this.sources.map((s) => s.list(query)));
    const merged: Assignment[] = [];
    for (const l of lists) {
      if (!l.ok) return l;
      merged.push(...l.value);
    }
    return ok(dedupeAssignments(merged));
  }
}
