import test from "node:test";
import assert from "node:assert/strict";
import { pickToFilter, NO_FILTER, isFiltered, groupsOf, restrictSheetToGroup, restrictPlanToStatus, statusesOf } from "../dist/index.js";

const choices = { periods: [{ id: "q1", label: "Jan – Mar 2026" }], places: [{ key: "gulu", label: "Gulu" }], groups: ["Female", "Male"], statuses: ["Late", "Done"] };

test("a clicked label means one thing, in a fixed order, and the same label again clears it", () => {
  let f = pickToFilter(choices, NO_FILTER, "Jan – Mar 2026");
  assert.equal(f.periodId, "q1");
  f = pickToFilter(choices, f, "gulu"); assert.deepEqual(f.places, ["gulu"]);
  f = pickToFilter(choices, f, "FEMALE"); assert.equal(f.group, "Female");
  f = pickToFilter(choices, f, "Late"); assert.equal(f.status, "Late");
  assert.equal(isFiltered(f), true);
  assert.equal(pickToFilter(choices, f, "Nothing like it"), f, "an unknown label changes nothing");
  f = pickToFilter(choices, pickToFilter(choices, pickToFilter(choices, pickToFilter(choices, f, "Jan – Mar 2026"), "Gulu"), "female"), "late");
  assert.equal(isFiltered(f), false);
});

const sheet = { projectId: "p", periods: [], indicators: [{ id: "i", target: "500" }], finance: [], cells: [
  { indicatorId: "i", periodId: "q1", periodValue: "100", cumulativeValue: "100", status: "VERIFIED", breakdown: [{ dimension: "SEX", category: "Female", value: "60" }, { dimension: "SEX", category: "Male", value: "40" }, { dimension: "LOCATION", category: "Gulu", value: "70" }] },
  { indicatorId: "i", periodId: "q2", periodValue: "50", cumulativeValue: "150", status: "DRAFT" },
] };

test("a group sees what was recorded for it; a period nobody broke down is empty, never 0, and there is no invented cumulative", () => {
  assert.deepEqual(groupsOf(sheet), ["Female", "Male"]);
  const f = restrictSheetToGroup(sheet, "female");
  assert.deepEqual(f.cells.map((c) => [c.periodValue, c.cumulativeValue]), [["60", ""], ["", ""]]);
  assert.equal(restrictSheetToGroup(sheet, ""), sheet);
  assert.equal(f.indicators[0].target, "", "a group is not compared with the project target");
  assert.deepEqual(restrictSheetToGroup(sheet, "gulu").cells.map((c) => c.periodValue), ["", ""], "a place is not a group");
});

test("planned work is narrowed by its plain status or its code", () => {
  const rows = [{ status: "IN_PROGRESS", signalLabel: "Late" }, { status: "DONE", signalLabel: "Done" }];
  assert.equal(restrictPlanToStatus(rows, "late").length, 1);
  assert.equal(restrictPlanToStatus(rows, "DONE")[0].signalLabel, "Done");
  assert.equal(restrictPlanToStatus(rows, "").length, 2);
  assert.deepEqual(statusesOf(rows), ["Late", "Done"]);
});
