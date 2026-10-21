import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROJECT_FILTERS, filterProjects, sortProjects, type PortfolioProject } from "../../src/features/projects/presentation/project-portfolio.ts";

const project = (over: Partial<PortfolioProject>): PortfolioProject => ({
  id: "p", title: "Alpha", projectCode: "A-1", donorName: "USAID", country: "Kenya", status: "ACTIVE", reportingFrequency: "MONTHLY",
  startDate: "2026-01-01", endDate: "2026-12-31", daysRemaining: 100, sector: "WASH", ...over,
});
const projects = [
  project({ id: "a", title: "Alpha" }),
  project({ id: "b", title: "Beta", donorName: "EU", country: "Ghana" }),
  project({ id: "c", title: "Gamma", donorName: "USAID", country: "Ghana" }),
];
const ids = (list: PortfolioProject[]) => list.map((p) => p.id);

test("no filter keeps every live project", () => {
  assert.deepEqual(ids(filterProjects(projects, DEFAULT_PROJECT_FILTERS)), ["a", "b", "c"]);
});

test("donor and country narrow the list, together and alone", () => {
  assert.deepEqual(ids(filterProjects(projects, { ...DEFAULT_PROJECT_FILTERS, donor: "USAID" })), ["a", "c"]);
  assert.deepEqual(ids(filterProjects(projects, { ...DEFAULT_PROJECT_FILTERS, country: "Ghana" })), ["b", "c"]);
  assert.deepEqual(ids(filterProjects(projects, { ...DEFAULT_PROJECT_FILTERS, donor: "USAID", country: "Ghana" })), ["c"]);
});

test("a donor nobody has gives an empty list, not everything", () => {
  assert.deepEqual(filterProjects(projects, { ...DEFAULT_PROJECT_FILTERS, donor: "Nobody" }), []);
});

test("sorting by title still works on a filtered list", () => {
  assert.deepEqual(ids(sortProjects(filterProjects(projects, { ...DEFAULT_PROJECT_FILTERS, country: "Ghana" }), "title")), ["b", "c"]);
});
