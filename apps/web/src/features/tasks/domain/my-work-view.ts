/**
 * What the My Work screen shows, as pure helpers: the project filter (chips), the words for a due date, and who asked.
 * Never a code or an ISO date in front of a person.
 */
import { formatShortDate } from "@donordesk/domain/contexts/workplan/index.js";

/** The parts of an assignment these helpers read (the server schema satisfies this structurally; no server import here). */
export interface WorkItemShape {
  key: string;
  kind: string;
  projectId: string;
  projectTitle: string;
  dueDate?: string | undefined;
  state: "OPEN" | "LATE";
  askedById?: string | undefined;
}
export interface WorkGroupOf<T extends WorkItemShape> { key: string; label: string; items: T[] }
export type WorkGroup = WorkGroupOf<WorkItemShape>;
type AssignmentItem = WorkItemShape;

/** Keeps the order and the groups; a group left empty by the filter is not shown. */
export function filterGroupsByProject<G extends { items: WorkItemShape[] }>(groups: ReadonlyArray<G>, projectId: string | "all"): G[] {
  if (projectId === "all") return [...groups];
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => i.projectId === projectId) })).filter((g) => g.items.length > 0);
}

/** The projects that have something, for the chips (alphabetical), with how many each. */
export function projectChips(groups: ReadonlyArray<{ items: WorkItemShape[] }>): Array<{ id: string; title: string; count: number }> {
  const byId = new Map<string, { id: string; title: string; count: number }>();
  for (const g of groups) for (const i of g.items) {
    const chip = byId.get(i.projectId) ?? { id: i.projectId, title: i.projectTitle, count: 0 };
    chip.count += 1;
    byId.set(i.projectId, chip);
  }
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export function dueText(item: Pick<AssignmentItem, "dueDate" | "state">, today: string): string {
  if (!item.dueDate) return "";
  if (item.dueDate < today) return `was due ${formatShortDate(item.dueDate, today)}`;
  if (item.dueDate === today) return "due today";
  return `due ${formatShortDate(item.dueDate, today)}`;
}

export function askedByText(item: Pick<AssignmentItem, "kind" | "askedById">, userId: string, names: Readonly<Record<string, string>>): string {
  if (item.kind !== "TASK" || !item.askedById) return "";
  return `asked by ${item.askedById === userId ? "you" : (names[item.askedById] ?? "a team member")}`;
}

export function totalIn(groups: ReadonlyArray<{ items: unknown[] }>): number {
  return groups.reduce((n, g) => n + g.items.length, 0);
}
