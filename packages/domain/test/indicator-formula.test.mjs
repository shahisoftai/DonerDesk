import test from "node:test";
import assert from "node:assert/strict";
import { validateFormula, evaluateFormula, deriveFormulaCells, describeFormula, parseFormula, formulaDependencies } from "../dist/index.js";

const I = (id, type = "NUMBER", formula) => ({ id, code: id.toUpperCase(), type, ...(formula ? { formula } : {}) });
const all = [I("a"), I("b"), I("c"), I("pct", "PERCENTAGE"), I("rate", "RATIO")];

test("a ratio needs two counts and a rate result; a total or difference needs counts and a count result", () => {
  assert.ok(validateFormula("pct", "PERCENTAGE", { op: "RATIO", terms: ["a", "b"], percent: true }, all).ok);
  assert.match(validateFormula("x", "NUMBER", { op: "RATIO", terms: ["a", "b"] }, all).error.message, /Percentage or Ratio/);
  assert.match(validateFormula("pct", "PERCENTAGE", { op: "RATIO", terms: ["a"] }, all).error.message, /needs two/);
  assert.match(validateFormula("pct", "PERCENTAGE", { op: "RATIO", terms: ["a", "a"] }, all).error.message, /two different/);
  assert.match(validateFormula("pct", "PERCENTAGE", { op: "RATIO", terms: ["a", "rate"] }, all).error.message, /already a rate/);
  assert.ok(validateFormula("total", "NUMBER", { op: "SUM", terms: ["a", "b", "c"] }, all).ok);
  assert.match(validateFormula("total", "NUMBER", { op: "SUM", terms: ["a", "pct"] }, all).error.message, /rate or a percentage/);
  assert.match(validateFormula("total", "NUMBER", { op: "SUM", terms: ["a"] }, all).error.message, /at least two/);
  assert.match(validateFormula("total", "PERCENTAGE", { op: "SUM", terms: ["a", "b"] }, all).error.message, /Number or Currency/);
  assert.ok(validateFormula("d", "NUMBER", { op: "DIFFERENCE", terms: ["a", "b"] }, all).ok);
});

test("unknown indicators, self reference and circles are refused", () => {
  assert.match(validateFormula("t", "NUMBER", { op: "SUM", terms: ["a", "zzz"] }, all).error.message, /this project/);
  assert.match(validateFormula("a", "NUMBER", { op: "SUM", terms: ["a", "b"] }, all).error.message, /from itself/);
  const loop = [I("x", "NUMBER", { op: "SUM", terms: ["y", "b"] }), I("y", "NUMBER"), I("b")];
  assert.match(validateFormula("y", "NUMBER", { op: "SUM", terms: ["x", "b"] }, loop).error.message, /in a circle/);
  const chain = [I("x", "NUMBER", { op: "SUM", terms: ["a", "b"] }), I("a"), I("b")];
  assert.ok(validateFormula("t", "NUMBER", { op: "SUM", terms: ["x", "a"] }, chain).ok);
});

test("evaluation is exact decimal; a missing term or a zero divisor is not a number, never zero", () => {
  const v = (o) => new Map(Object.entries(o));
  assert.equal(evaluateFormula({ op: "RATIO", terms: ["a", "b"], percent: true }, v({ a: "45", b: "60" })).value, "75");
  assert.equal(evaluateFormula({ op: "RATIO", terms: ["a", "b"], percent: true }, v({ a: "1", b: "3" })).value, "33.3333");
  assert.equal(evaluateFormula({ op: "RATIO", terms: ["a", "b"] }, v({ a: "1", b: "4" })).value, "0.25");
  assert.deepEqual(evaluateFormula({ op: "RATIO", terms: ["a", "b"] }, v({ a: "1", b: "0" })), { value: null, reason: "DIVIDE_BY_ZERO" });
  assert.deepEqual(evaluateFormula({ op: "SUM", terms: ["a", "b"] }, v({ a: "1" })), { value: null, reason: "MISSING_TERM" });
  assert.deepEqual(evaluateFormula({ op: "SUM", terms: ["a", "b"] }, v({ a: "1", b: "" })), { value: null, reason: "MISSING_TERM" });
  assert.equal(evaluateFormula({ op: "SUM", terms: ["a", "b", "c"] }, v({ a: "1,200", b: "0.1", c: "0.2" })).value, "1200.3");
  assert.equal(evaluateFormula({ op: "DIFFERENCE", terms: ["a", "b"] }, v({ a: "5", b: "8" })).value, "-3");
  assert.equal(evaluateFormula({ op: "SUM", terms: ["a", "b"] }, v({ a: "0", b: "0" })).value, "0");
});

test("sheet cells: period and cumulative are worked out apart; a period missing a term has no cell; status is the weakest term", () => {
  const cells = [
    { indicatorId: "a", periodId: "p1", periodValue: "10", cumulativeValue: "10", status: "VERIFIED" },
    { indicatorId: "b", periodId: "p1", periodValue: "20", cumulativeValue: "20", status: "VERIFIED" },
    { indicatorId: "a", periodId: "p2", periodValue: "10", cumulativeValue: "20", status: "VERIFIED" },
    { indicatorId: "b", periodId: "p2", periodValue: "40", cumulativeValue: "60", status: "DRAFT" },
    { indicatorId: "a", periodId: "p3", periodValue: "5", cumulativeValue: "25", status: "VERIFIED" },
  ];
  const inds = [{ id: "pct", formula: { op: "RATIO", terms: ["a", "b"], percent: true } }, { id: "a" }, { id: "b" }];
  const out = deriveFormulaCells(inds, cells, ["p1", "p2", "p3"]);
  assert.deepEqual(out.map((c) => [c.periodId, c.periodValue, c.cumulativeValue, c.status]), [["p1", "50", "50", "VERIFIED"], ["p2", "25", "33.3333", "DRAFT"]]);
  assert.ok(out.every((c) => c.calculated === true));
});

test("formulas that use formulas are settled in order, whatever the list order", () => {
  const cells = [
    { indicatorId: "a", periodId: "p1", periodValue: "2", cumulativeValue: "2", status: "VERIFIED" },
    { indicatorId: "b", periodId: "p1", periodValue: "3", cumulativeValue: "3", status: "VERIFIED" },
    { indicatorId: "c", periodId: "p1", periodValue: "4", cumulativeValue: "4", status: "VERIFIED" },
  ];
  const inds = [{ id: "top", formula: { op: "SUM", terms: ["mid", "c"] } }, { id: "mid", formula: { op: "SUM", terms: ["a", "b"] } }];
  const out = deriveFormulaCells(inds, cells, ["p1"]);
  assert.deepEqual(Object.fromEntries(out.map((c) => [c.indicatorId, c.periodValue])), { mid: "5", top: "9" });
  assert.deepEqual(deriveFormulaCells([{ id: "a" }], cells, ["p1"]), []);
});

test("describe and parse", () => {
  assert.equal(describeFormula({ op: "RATIO", terms: ["a", "b"], percent: true }, (id) => id.toUpperCase()), "Calculated: A ÷ B × 100");
  assert.equal(describeFormula({ op: "SUM", terms: ["a", "b"] }, (id) => id), "Calculated: a + b");
  assert.deepEqual(parseFormula('{"op":"SUM","terms":["a","b"]}'), { op: "SUM", terms: ["a", "b"] });
  assert.equal(parseFormula("nonsense"), undefined);
  assert.equal(parseFormula(null), undefined);
  assert.deepEqual(formulaDependencies({ op: "SUM", terms: ["a", "a", "b"] }), ["a", "b"]);
});
