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

// ---- double-count guard -----------------------------------------------------------------------------------------------
const gbase = { donorName: "D", indicatorCode: "O1", indicatorName: "People reached", unit: "people", type: "NUMBER", target: 100, verifiedAsOf: "2026-06-30" };
const grow = (projectId, over = {}) => ({ ...gbase, projectId, projectTitle: projectId.toUpperCase(), verifiedCumulative: 50, country: "KE", startDate: "2026-01-01", endDate: "2026-12-31", ...over });

test("an indicator marked as counted by another project is listed, not added", () => {
  const [g] = rollUpIndicators([grow("a"), grow("b", { countedElsewhere: true })]);
  assert.equal(g.total, 50);
  assert.equal(g.targetTotal, 100);
  assert.deepEqual(g.projects.map((p) => p.projectId), ["a"]);
  assert.deepEqual(g.countedElsewhere.map((p) => p.projectId), ["b"]);
  assert.equal(g.possibleOverlap, null); // only one project is counted, so there is nothing to double
});

test("two counted projects in the same country with overlapping dates are flagged, and the total is left as it is", () => {
  const [g] = rollUpIndicators([grow("a"), grow("b", { startDate: "2026-06-01", endDate: "2027-05-31" })]);
  assert.equal(g.total, 100);
  assert.deepEqual(g.possibleOverlap.projects, ["A", "B"]);
  assert.match(g.possibleOverlap.message, /counts them twice/);
});

test("different countries, disjoint dates or missing dates are not flagged", () => {
  assert.equal(rollUpIndicators([grow("a"), grow("b", { country: "UG" })])[0].possibleOverlap, null);
  assert.equal(rollUpIndicators([grow("a", { endDate: "2026-03-31" }), grow("b", { startDate: "2026-04-01" })])[0].possibleOverlap, null);
  assert.equal(rollUpIndicators([grow("a"), grow("b", { startDate: undefined })])[0].possibleOverlap, null);
});

test("the spreadsheet says why a row is not added and names a possible double count", () => {
  const rows = rollupTable(rollUpIndicators([grow("a"), grow("b", { countedElsewhere: true }), grow("c")]));
  assert.ok(rows.some((r) => r[4] === "B" && /Counted by another project/.test(r[r.length - 1])));
  assert.ok(rows.some((r) => /Possible double count/.test(r[r.length - 1])));
});
