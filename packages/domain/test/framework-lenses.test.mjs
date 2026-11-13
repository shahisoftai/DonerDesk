import assert from "node:assert/strict";
import test from "node:test";
import { FRAMEWORK_LENSES, FRAMEWORK_LENS_KEYS, renderFramework, frameworkColumns, lensProblems, isFrameworkLens, presetVocabulary, buildLogframeSnapshot } from "../dist/index.js";

const item = (o) => ({ id: "x", level: "OUTPUT", title: "T", sortOrder: 0, ...o });
const ind = (o) => ({ id: "n", logframeItemId: "o1", code: "IND-1", name: "People trained", type: "NUMBER", baseline: "0", target: "100", disaggregationRequired: false, isArchived: false, targetBreakdowns: [], ...o });
const snapshot = buildLogframeSnapshot(
  [
    item({ id: "g", level: "GOAL", code: "G", title: "Healthy children", rationale: "Health is the aim" }),
    item({ id: "o1", level: "OUTCOME", code: "1", title: "Better feeding", parentId: "g", rationale: "Feeding lowers wasting", assumptions: "Food is available", sortOrder: 1 }),
    item({ id: "p1", level: "OUTPUT", code: "1.1", title: "Counselling held", parentId: "o1", sortOrder: 2 }),
    item({ id: "a1", level: "ACTIVITY", code: "1.1.1", title: "Run sessions", parentId: "p1", sortOrder: 3 }),
  ],
  [ind({ logframeItemId: "o1" }), ind({ id: "n2", code: "IND-2", name: "Old", logframeItemId: "o1", isArchived: true }), ind({ id: "n3", code: "IND-3", name: "Sessions", logframeItemId: "a1", baseline: "", target: "200" })],
);

test("every lens satisfies the same contract and names columns for what it shows", () => {
  assert.deepEqual(FRAMEWORK_LENS_KEYS.sort(), ["LOGFRAME", "RESULTS"]);
  for (const key of FRAMEWORK_LENS_KEYS) {
    const lens = FRAMEWORK_LENSES[key];
    assert.deepEqual(lensProblems(lens), [], key);
    const columns = frameworkColumns(lens);
    assert.equal(columns[0].key, "level");
    assert.equal(new Set(columns.map((c) => c.key)).size, columns.length, `${key}: a column is named once`);
    const doc = renderFramework(snapshot, lens);
    for (const row of doc.rows) assert.deepEqual(Object.keys(row.cells).sort(), columns.map((c) => c.key).sort(), `${key}: a row has exactly the lens's cells`);
  }
  assert.equal(isFrameworkLens("RESULTS"), true);
  assert.equal(isFrameworkLens("toString"), false);
});

test("the Results Framework lens shows the chain and the reasoning, not the activity level or the measurement matrix", () => {
  const doc = renderFramework(snapshot, FRAMEWORK_LENSES.RESULTS, presetVocabulary("USAID"));
  assert.equal(doc.title, "Results Framework");
  const results = doc.rows.filter((r) => r.kind === "RESULT");
  assert.deepEqual(results.map((r) => r.cells.level), ["Goal", "Intermediate Result", "Sub-Intermediate Result"]);
  assert.deepEqual(results.map((r) => r.depth), [0, 1, 2]);
  assert.equal(results[1].cells.rationale, "Feeding lowers wasting");
  assert.equal("baseline" in doc.rows[0].cells, false);
  assert.equal(doc.rows.some((r) => r.cells.title === "Run sessions"), false, "the activity level is left out");
  assert.equal(doc.rows.some((r) => r.cells.name === "Sessions"), false, "and so are its indicators");
});

test("the Logframe lens shows every level with the matrix columns; a gap is null, never 0; a retired indicator is left out", () => {
  const doc = renderFramework(snapshot, FRAMEWORK_LENSES.LOGFRAME);
  assert.equal(doc.title, "Logframe");
  assert.equal(doc.rows.filter((r) => r.kind === "RESULT").length, 4);
  const indicators = doc.rows.filter((r) => r.kind === "INDICATOR");
  assert.deepEqual(indicators.map((r) => r.cells.code), ["IND-1", "IND-3"]);
  assert.equal(indicators[1].cells.baseline, null);
  assert.equal(indicators[1].cells.target, "200");
  const columns = doc.columns;
  assert.equal(columns.find((c) => c.key === "baseline").owner, "INDICATOR");
  assert.equal(columns.find((c) => c.key === "assumptions").owner, "RESULT");
  const outcome = doc.rows.find((r) => r.cells.resultCode === "1");
  assert.equal(outcome.cells.assumptions, "Food is available");
  assert.equal(doc.rows.find((r) => r.kind === "INDICATOR").depth, 2, "an indicator sits one step under its result");
});

test("a result whose parent is not shown becomes a root rather than being lost", () => {
  const doc = renderFramework(snapshot, { ...FRAMEWORK_LENSES.RESULTS, levels: ["OUTCOME", "OUTPUT"] });
  assert.deepEqual(doc.rows.filter((r) => r.kind === "RESULT").map((r) => [r.cells.resultCode, r.depth]), [["1", 0], ["1.1", 1]]);
});

test("the same snapshot, lens and words always give the same document", () => {
  assert.deepEqual(renderFramework(snapshot, FRAMEWORK_LENSES.LOGFRAME), renderFramework(snapshot, FRAMEWORK_LENSES.LOGFRAME));
});

test("the lenses read results in the tree's order: OC1 before OC2 even when ids say otherwise, and codes numerically (1.10 after 1.2)", () => {
  const snap = buildLogframeSnapshot(
    [
      item({ id: "zz", level: "OUTCOME", code: "OC1", title: "First outcome" }),
      item({ id: "aa", level: "OUTCOME", code: "OC2", title: "Second outcome" }),
      item({ id: "m1", level: "OUTPUT", code: "1.10", title: "Tenth", parentId: "zz" }),
      item({ id: "m2", level: "OUTPUT", code: "1.2", title: "Second", parentId: "zz" }),
    ],
    [ind({ id: "x2", code: "IND-10", logframeItemId: "m2" }), ind({ id: "x1", code: "IND-2", logframeItemId: "m2" })],
  );
  const doc = renderFramework(snap, FRAMEWORK_LENSES.LOGFRAME);
  assert.deepEqual(doc.rows.filter((r) => r.kind === "RESULT").map((r) => r.cells.resultCode), ["OC1", "1.2", "1.10", "OC2"]);
  assert.deepEqual(doc.rows.filter((r) => r.kind === "INDICATOR").map((r) => r.cells.code), ["IND-2", "IND-10"]);
});
