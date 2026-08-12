import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyBand, type DeadlineBand } from "../../src/features/dashboard/presentation/deadline-bands.ts";
import {
  filterProjects,
  sortProjects,
  type ProjectFilters,
  type PortfolioProject,
} from "../../src/features/projects/presentation/project-portfolio.ts";
import {
  filterWorkItems,
  paginate,
  workItemHref,
} from "../../src/features/work-items/presentation/work-items-view.ts";
import { compareUrgency, urgencyOf, type WorkItem } from "../../src/features/work-items/domain/work-item.ts";

test("classifyBand maps negative, zero, 1-3, 4+, and null correctly", () => {
  assert.equal(classifyBand(-5), "overdue");
  assert.equal(classifyBand(0), "today");
  assert.equal(classifyBand(3), "soon");
  assert.equal(classifyBand(7), "later");
  assert.equal(classifyBand(null), null);
  assert.equal(classifyBand(undefined), null);
});

test("project filter hides archived by default and matches query/status/sector", () => {
  const projects: PortfolioProject[] = [
    mkProject("p1", "Alpha", "ACTIVE", "NUTRITION"),
    mkProject("p2", "Beta", "ARCHIVED", "HEALTH"),
    mkProject("p3", "Gamma", "ACTIVE", "HEALTH"),
  ];
  const base: ProjectFilters = { query: "", status: "all", sector: "all", sort: "title", page: 1, archived: false };
  assert.equal(filterProjects(projects, base).length, 2, "archived hidden by default");
  assert.equal(filterProjects(projects, { ...base, query: "alp" }).length, 1);
  assert.equal(filterProjects(projects, { ...base, status: "ARCHIVED", archived: true }).length, 1);
  assert.equal(filterProjects(projects, { ...base, sector: "HEALTH" }).length, 1);
});

test("project sort by title and by deadline", () => {
  const projects: PortfolioProject[] = [
    mkProject("a", "Beta", "ACTIVE", "NUTRITION"),
    mkProject("b", "Alpha", "ACTIVE", "NUTRITION"),
  ];
  projects[0].daysRemaining = 90;
  projects[1].daysRemaining = 10;
  const byTitle = sortProjects(projects, "title");
  assert.equal(byTitle[0]!.title, "Alpha");
  const byDeadline = sortProjects(projects, "deadline");
  assert.equal(byDeadline[0]!.id, "b", "soonest deadline first");
});

test("urgency ordering sorts overdue first then soonest", () => {
  const items: WorkItem[] = [
    { kind: "report", id: "r1", projectId: "p", projectTitle: "P", periodId: "x", periodStatus: "IN_PROGRESS", deadline: null, daysUntilDeadline: 10, urgency: urgencyOf(10, 30) },
    { kind: "report", id: "r2", projectId: "p", projectTitle: "P", periodId: "y", periodStatus: "IN_PROGRESS", deadline: null, daysUntilDeadline: -2, urgency: urgencyOf(-2, 30) },
    { kind: "notification", id: "n1", type: "ASSIGNMENT", title: "N", message: "", read: false, urgency: 5 },
  ];
  const sorted = [...items].sort(compareUrgency);
  assert.equal(sorted[0]!.kind, "report");
  assert.equal(sorted[0]!.id, "r2", "overdue first");
});

test("filterWorkItems filters by type, project, and due", () => {
  const items: WorkItem[] = [
    { kind: "report", id: "r1", projectId: "p1", projectTitle: "A", periodId: "x", periodStatus: "IN_PROGRESS", deadline: null, daysUntilDeadline: -1, urgency: 0 },
    { kind: "checklist", id: "c1", projectId: "p2", projectTitle: "B", periodId: "y", severity: "HIGH", title: "gap", dueDate: null, daysUntilDeadline: 1, urgency: 1 },
    { kind: "notification", id: "n1", type: "ASSIGNMENT", title: "N", message: "", read: false, urgency: 5 },
  ];
  assert.equal(filterWorkItems(items, { type: "report", projectId: "all", due: "all" }).length, 1);
  assert.equal(filterWorkItems(items, { type: "all", projectId: "p2", due: "all" }).length, 1);
  assert.equal(filterWorkItems(items, { type: "all", projectId: "all", due: "overdue" }).length, 1);
  assert.equal(filterWorkItems(items, { type: "all", projectId: "all", due: "soon" }).length, 1);
});

test("paginate slices pages", () => {
  const arr = [1, 2, 3, 4, 5];
  assert.deepEqual(paginate(arr, 1, 2), [1, 2]);
  assert.deepEqual(paginate(arr, 3, 2), [5]);
});

test("workItemHref produces safe destinations per kind", () => {
  const report: WorkItem = { kind: "report", id: "r", projectId: "p1", projectTitle: "A", periodId: "per", periodStatus: "DRAFT", deadline: null, daysUntilDeadline: 1, urgency: 1 };
  const checklist: WorkItem = { kind: "checklist", id: "c", projectId: "p2", projectTitle: "B", periodId: "", severity: "HIGH", title: "g", dueDate: null, daysUntilDeadline: null, urgency: 2 };
  const ev: WorkItem = { kind: "evidence", id: "e", projectId: "p3", projectTitle: "C", fileName: "f", verificationStatus: "PENDING_REVIEW", urgency: 3 };
  assert.equal(workItemHref(report), "/projects/p1/reports/per");
  assert.equal(workItemHref(checklist), "/projects/p2/compliance");
  assert.equal(workItemHref(ev), "/projects/p3/evidence");
});

function mkProject(id: string, title: string, status: string, sector: string): PortfolioProject {
  return {
    id, title, projectCode: id.toUpperCase(), donorName: "Donor", country: "X",
    status, reportingFrequency: "QUARTERLY", startDate: "2026-01-01", endDate: "2027-01-01",
    daysRemaining: 100, sector,
  };
}
