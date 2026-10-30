import test from "node:test";
import assert from "node:assert/strict";
import { restrictWidgetToPeriod } from "../dist/index.js";

const v2 = { id: "w", projectId: "p", kind: "CHART", x: 0, y: 0, w: 4, h: 3, spec: { version: 2, kind: "BAR", dataset: { template: "SINGLE", indicatorIds: ["i"], fromPeriodId: "a", toPeriodId: "c" } } };

test("a chart of a project that has the period is narrowed to it, without touching the original", () => {
  const out = restrictWidgetToPeriod(v2, "b", ["a", "b", "c"]);
  assert.equal(out.spec.dataset.fromPeriodId, "b");
  assert.equal(out.spec.dataset.toPeriodId, "b");
  assert.equal(v2.spec.dataset.fromPeriodId, "a");
});
test("a project without that period, and a text block, stay as saved", () => {
  assert.equal(restrictWidgetToPeriod(v2, "zzz", ["a"]), v2);
  assert.equal(restrictWidgetToPeriod(v2, "b", undefined), v2);
  const text = { id: "t", projectId: "p", kind: "TEXT", text: "hi", x: 0, y: 0, w: 1, h: 1 };
  assert.equal(restrictWidgetToPeriod(text, "b", ["b"]), text);
});
test("a saved report and an older chart are narrowed too", () => {
  const rep = { id: "r", projectId: "p", kind: "REPORT", report: { indicatorIds: ["i"], measure: "PERIOD", rows: "INDICATOR", includeDraft: false }, x: 0, y: 0, w: 1, h: 1 };
  assert.equal(restrictWidgetToPeriod(rep, "b", ["b"]).report.fromPeriodId, "b");
  const old = { id: "o", projectId: "p", spec: { template: "X" }, x: 0, y: 0, w: 1, h: 1 };
  assert.equal(restrictWidgetToPeriod(old, "b", ["b"]).spec.toPeriodId, "b");
});
