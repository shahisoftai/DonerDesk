import test from "node:test";
import assert from "node:assert/strict";
import { rollUpIndicators } from "../dist/index.js";

const row = (projectId, extra = {}) => ({
  projectId, projectTitle: `Project ${projectId}`, donorName: "EU", indicatorCode: "1.1", indicatorName: "Children screened",
  unit: "children", type: "NUMBER", target: 100, verifiedCumulative: 40, verifiedAsOf: "2026-06-30", ...extra,
});

test("verified values are summed per donor and code; the targets are summed too", () => {
  const [g] = rollUpIndicators([row("a"), row("b", { verifiedCumulative: 25, target: 50 })]);
  assert.equal(g.total, 65);
  assert.equal(g.targetTotal, 150);
  assert.equal(g.percentOfTarget, 43.3);
  assert.equal(g.projects.length, 2);
});

test("a project with no verified value is not measured: it is not counted as zero", () => {
  const [g] = rollUpIndicators([row("a", { verifiedCumulative: null, verifiedAsOf: null }), row("b", { verifiedCumulative: null })]);
  assert.equal(g.total, null);
  assert.equal(g.percentOfTarget, null);
  const [mixed] = rollUpIndicators([row("a", { verifiedCumulative: null }), row("b", { verifiedCumulative: 10, target: null })]);
  assert.equal(mixed.total, 10);
  assert.equal(mixed.targetTotal, 100, "only a target that is a number is added");
});

test("a different donor is a different group, and a project whose unit or type differs is listed, not summed", () => {
  const groups = rollUpIndicators([row("a"), row("b", { donorName: "USAID" }), row("c", { unit: "households" })]);
  assert.equal(groups.length, 2);
  const eu = groups.find((g) => g.donorName === "EU");
  assert.equal(eu.total, 40);
  assert.deepEqual(eu.mismatched.map((p) => p.projectId), ["c"]);
});

test("a percentage indicator has no percent of target, and groups sort by donor then code", () => {
  const groups = rollUpIndicators([
    row("a", { indicatorCode: "10.1", type: "PERCENTAGE", unit: "%" }),
    row("b", { indicatorCode: "2.1" }),
    row("c", { donorName: "AFD" }),
  ]);
  assert.deepEqual(groups.map((g) => `${g.donorName} ${g.indicatorCode}`), ["AFD 1.1", "EU 2.1", "EU 10.1"]);
  assert.equal(groups.find((g) => g.indicatorCode === "10.1").percentOfTarget, null);
});

import { rollupTable, ROLLUP_TABLE_HEADER, toCsv } from "../dist/index.js";

test("the roll-up becomes a sheet: a row per project, 'Not measured' for a missing value, and a note on one that is not added", () => {
  const groups = rollUpIndicators([row("a"), row("b", { verifiedCumulative: null, verifiedAsOf: null }), row("c", { unit: "households", verifiedCumulative: 9 })]);
  const table = rollupTable(groups);
  assert.deepEqual(table[0], [...ROLLUP_TABLE_HEADER]);
  assert.equal(table.length, 4, "header + three projects");
  const byProject = Object.fromEntries(table.slice(1).map((r) => [r[4], r]));
  assert.equal(byProject["Project a"][5], "40");
  assert.equal(byProject["Project b"][5], "Not measured", "never 0");
  assert.equal(byProject["Project a"][8], "40", "group total repeats on each row");
  assert.match(byProject["Project c"][11], /not added to the total/);
});

test("a project title that looks like a formula stays text in the CSV", () => {
  const groups = rollUpIndicators([row("a", { projectTitle: "=HYPERLINK(\"http://x\")" })]);
  const csv = toCsv(rollupTable(groups));
  assert.match(csv, /'=HYPERLINK/);
});
