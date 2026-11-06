/**
 * The List view: planned activities grouped This week / Next week / Later / Done (Done collapsed). Pure: the page
 * passes today's date in. Empty groups are not shown. Activities that are late or under way sit in "This week" so
 * nothing that needs attention is hidden under "Later".
 */
export type PlanGroupKey = "THIS_WEEK" | "NEXT_WEEK" | "LATER" | "DONE";

export const PLAN_GROUP_LABEL: Readonly<Record<PlanGroupKey, string>> = {
  THIS_WEEK: "This week",
  NEXT_WEEK: "Next week",
  LATER: "Later",
  DONE: "Done",
};

const GROUP_ORDER: ReadonlyArray<PlanGroupKey> = ["THIS_WEEK", "NEXT_WEEK", "LATER", "DONE"];

export interface PlanListItem {
  id: string;
  title: string;
  plannedStart: string;
  plannedEnd: string;
  status: "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  signal: "ON_TIME" | "LATE" | "DONE" | "CANCELLED";
  ownerUserId?: string;
  supportUserIds: string[];
}

export interface PlanGroup<T extends PlanListItem> {
  key: PlanGroupKey;
  label: string;
  items: T[];
  collapsed: boolean;
}

const DAY = 86_400_000;
const utc = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** Monday of the week containing `date` (weeks run Monday to Sunday). */
export function startOfWeek(date: string): string {
  const t = utc(date);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * DAY).toISOString().slice(0, 10);
}

export function groupFor(item: PlanListItem, today: string): PlanGroupKey {
  if (item.status === "DONE" || item.status === "CANCELLED") return "DONE";
  const thisWeekEnd = utc(startOfWeek(today)) + 7 * DAY - 1;
  const start = utc(item.plannedStart);
  if (item.signal === "LATE" || item.status === "IN_PROGRESS" || start <= thisWeekEnd) return "THIS_WEEK";
  return start <= thisWeekEnd + 7 * DAY ? "NEXT_WEEK" : "LATER";
}

export function isMine(item: PlanListItem, userId: string | undefined): boolean {
  return userId !== undefined && (item.ownerUserId === userId || item.supportUserIds.includes(userId));
}

export function groupPlanList<T extends PlanListItem>(items: ReadonlyArray<T>, today: string, options: { mineOnly?: boolean; userId?: string; completedOnly?: boolean } = {}): PlanGroup<T>[] {
  let visible = options.mineOnly ? items.filter((i) => isMine(i, options.userId)) : items;
  if (options.completedOnly) visible = visible.filter((i) => i.status === "DONE" || i.status === "CANCELLED");
  return GROUP_ORDER.map((key) => ({
    key,
    label: PLAN_GROUP_LABEL[key],
    items: visible
      .filter((i) => groupFor(i, today) === key)
      .sort((a, b) => (key === "DONE" ? b.plannedEnd.localeCompare(a.plannedEnd) : a.plannedStart.localeCompare(b.plannedStart)) || a.title.localeCompare(b.title)),
    collapsed: key === "DONE" && !options.completedOnly,
  })).filter((g) => g.items.length > 0);
}
