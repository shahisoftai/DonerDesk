/**
 * What else moves when an activity is moved on the timeline. It runs the domain's own cascade rule over the rows the page already
 * has, so the preview and the server cannot disagree. Pure: no React, no clock.
 */
import { cascadeAfterMove, type PlanDependencyItem, type PlanDependencyLink } from "@donordesk/domain/contexts/workplan/index.js";

export interface CascadeRow {
  id: string;
  title: string;
  projectId?: string;
  plannedStart: string;
  plannedEnd: string;
  status: string;
  /** Activities that wait for this one. */
  comesBefore: ReadonlyArray<{ id: string }>;
}

export interface CascadePreview {
  /** Activities that will be pushed, with their new dates and the activity that caused it. */
  moves: Array<{ id: string; title: string; from: { start: string; end: string }; to: { start: string; end: string }; causedBy: string }>;
  /** Activities that should move but are done or cancelled, so stay where they are. */
  blocked: Array<{ id: string; title: string; reason: "DONE" | "CANCELLED" }>;
}

export function cascadePreview(rows: ReadonlyArray<CascadeRow>, movedId: string, start: string, end: string): CascadePreview {
  const items: PlanDependencyItem[] = rows.map((r) => ({
    id: r.id, projectId: r.projectId ?? "project", status: r.status as PlanDependencyItem["status"],
    plannedStart: r.id === movedId ? start : r.plannedStart, plannedEnd: r.id === movedId ? end : r.plannedEnd,
  }));
  const links: PlanDependencyLink[] = rows.flatMap((r) => r.comesBefore.map((b) => ({ predecessorId: r.id, successorId: b.id })));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const cascade = cascadeAfterMove(items, links, movedId);
  return {
    moves: cascade.moves.map((m) => {
      const before = byId.get(m.id);
      return {
        id: m.id, title: before?.title ?? "", from: { start: before?.plannedStart ?? "", end: before?.plannedEnd ?? "" },
        to: { start: m.plannedStart, end: m.plannedEnd }, causedBy: byId.get(m.causedBy)?.title ?? "",
      };
    }),
    blocked: cascade.blocked.map((b) => ({ id: b.id, title: byId.get(b.id)?.title ?? "", reason: b.reason })),
  };
}
