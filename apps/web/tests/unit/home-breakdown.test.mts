import test from "node:test";
import assert from "node:assert/strict";
import { filterProjects, groupProjects, type BreakdownRow } from "../../src/features/dashboard/domain/home-breakdown.ts";

const row = (id: string, o: Partial<BreakdownRow> = {}): BreakdownRow => ({ projectId: id, sector: "WASH", status: "ACTIVE", country: "Ethiopia", donorName: "UNICEF", reportsOverdue: 0, delivery: { band: "ON_TRACK", lateActivities: 0, valuesOverdue: 0 }, risks: { reviewOverdue: 0 }, ...o });

test("groups count projects, largest first, ties by label, 'Not recorded' last and never dropped", () => {
  const g = groupProjects([row("1"), row("2"), row("3", { sector: "HEALTH" }), row("4", { sector: "" }), row("5", { sector: "EDUCATION" }), row("6", { sector: "" })], "SECTOR");
  assert.deepEqual(g.map((x) => [x.label, x.count]), [["Wash", 2], ["Education", 1], ["Health", 1], ["Not recorded", 2]]);
  assert.equal(g.reduce((n, x) => n + x.count, 0), 6);
});

test("keys match without regard to case, so a spelling difference does not split a group", () => {
  const g = groupProjects([row("1", { country: "Ethiopia" }), row("2", { country: "ethiopia" })], "COUNTRY");
  assert.equal(g.length, 1); assert.equal(g[0]!.count, 2);
});

test("a group click selects exactly its projects; an alert agrees with its count", () => {
  const rows = [row("1"), row("2", { sector: "HEALTH", reportsOverdue: 2 }), row("3", { reportsOverdue: 1, delivery: { band: "OFF_TRACK", lateActivities: 3, valuesOverdue: 0 } })];
  assert.deepEqual(filterProjects(rows, { by: "SECTOR", key: "WASH" }).map((r) => r.projectId), ["1", "3"]);
  assert.deepEqual(filterProjects(rows, { alert: "reports-overdue" }).map((r) => r.projectId), ["2", "3"]);
  assert.deepEqual(filterProjects(rows, { by: "SECTOR", key: "WASH", alert: "reports-overdue" }).map((r) => r.projectId), ["3"]);
  assert.deepEqual(filterProjects(rows, { alert: "behind" }).map((r) => r.projectId), ["3"]);
  assert.deepEqual(filterProjects(rows, { by: "SECTOR", key: "" }).map((r) => r.projectId), [], "'Not recorded' selects projects with no value");
});

test("an unknown breakdown or alert selects every row instead of failing", () => {
  const rows = [row("1"), row("2")];
  assert.equal(filterProjects(rows, { by: "NOPE", key: "x", alert: "nope" }).length, 2);
});
