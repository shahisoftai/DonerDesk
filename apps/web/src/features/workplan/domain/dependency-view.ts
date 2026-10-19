/**
 * Plain words and choices for "Comes after" (phase 28.1-A). Pure: the server decides what is allowed (loops, duplicates,
 * other projects); this only decides what the person is offered and how a wait reads.
 */
import { WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";

export interface DependencyOption { id: string; title: string }

/** "Waiting for Survey and Training", or undefined when nothing it waits for is unfinished. */
export function waitingLine(waitingFor: ReadonlyArray<{ title: string }>): string | undefined {
  if (waitingFor.length === 0) return undefined;
  const titles = waitingFor.map((w) => w.title);
  const names = titles.length === 1 ? titles[0]! : `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
  return `${WORKPLAN_COPY.waitingFor} ${names}`;
}

/**
 * Activities a person may pick as "comes after": every other live activity in the project, except those already linked
 * and those that already wait for this one (picking them would close a loop at once). Sorted by start, then title.
 */
export function dependencyOptions(
  itemId: string,
  rows: ReadonlyArray<{ id: string; title: string; status: string; plannedStart: string; comesAfter: ReadonlyArray<{ id: string }>; comesBefore: ReadonlyArray<{ id: string }> }>,
): DependencyOption[] {
  const linked = new Set(rows.find((r) => r.id === itemId)?.comesAfter.map((a) => a.id) ?? []);
  const successors = new Set(rows.find((r) => r.id === itemId)?.comesBefore.map((b) => b.id) ?? []);
  return rows
    .filter((r) => r.id !== itemId && r.status !== "CANCELLED" && !linked.has(r.id) && !successors.has(r.id))
    .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.title.localeCompare(b.title))
    .map((r) => ({ id: r.id, title: r.title }));
}
