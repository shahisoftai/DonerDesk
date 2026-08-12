import { compareUrgency, type WorkItem, type WorkItemType } from "../domain/work-item.ts";

export type WorkFilters = {
  type: WorkItemType | "all";
  projectId: string | "all";
  due: "all" | "overdue" | "today" | "soon";
};

export const DEFAULT_WORK_FILTERS: WorkFilters = {
  type: "all",
  projectId: "all",
  due: "all",
};

export function filterWorkItems(items: WorkItem[], filters: WorkFilters): WorkItem[] {
  return items
    .filter((item) => filters.type === "all" || item.kind === filters.type)
    .filter((item) => filters.projectId === "all" || (item.kind !== "notification" && item.projectId === filters.projectId))
    .filter((item) => matchesDue(item, filters.due))
    .sort(compareUrgency);
}

function matchesDue(item: WorkItem, due: WorkFilters["due"]): boolean {
  if (due === "all") return true;
  if (item.kind === "report" || item.kind === "checklist") {
    const days = item.daysUntilDeadline;
    if (due === "overdue") return days !== null && days !== undefined && days < 0;
    if (due === "today") return days === 0;
    if (due === "soon") return days !== null && days !== undefined && days >= 0 && days <= 3;
  }
  return false;
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function workItemHref(item: WorkItem): string {
  switch (item.kind) {
    case "report":
      return `/projects/${item.projectId}/reports/${item.periodId}`;
    case "checklist":
      return `/projects/${item.projectId}/compliance`;
    case "evidence":
      return `/projects/${item.projectId}/evidence`;
    case "activity":
      return `/projects/${item.projectId}/activities`;
    case "notification":
      return "/notifications";
  }
}

export function workItemTitle(item: WorkItem): string {
  switch (item.kind) {
    case "report":
      return `${item.projectTitle} — report`;
    case "checklist":
      return item.title;
    case "evidence":
      return item.fileName;
    case "activity":
      return item.activityTitle;
    case "notification":
      return item.title;
  }
}

export function workItemMeta(item: WorkItem): string {
  switch (item.kind) {
    case "report":
      return `Status: ${item.periodStatus.replace(/_/g, " ")}${item.deadline ? ` · due ${new Date(item.deadline).toLocaleDateString()}` : ""}`;
    case "checklist":
      return `Severity: ${item.severity.toLowerCase()}${item.dueDate ? ` · due ${new Date(item.dueDate).toLocaleDateString()}` : ""}`;
    case "evidence":
      return `Verification: ${item.verificationStatus.replace(/_/g, " ")}`;
    case "activity":
      return `Status: ${item.status.replace(/_/g, " ")}`;
    case "notification":
      return item.message || item.type;
  }
}
