import test from "node:test";
import assert from "node:assert/strict";
import { alertInputFromSheet, describeAlert, evaluateAlert } from "../dist/index.js";

const sheet = (cells, over = {}) => ({
  projectId: "p",
  periods: [
    { id: "p1", label: "Jan", start: "2026-01-01", end: "2026-01-31", reportType: "MONTHLY", locked: false },
    { id: "p2", label: "Feb", start: "2026-02-01", end: "2026-02-28", reportType: "MONTHLY", locked: false },
    { id: "p3", label: "Mar", start: "2026-03-01", end: "2026-03-31", reportType: "MONTHLY", locked: false },
  ],
  indicators: [{ id: "i1", code: "A", name: "Children enrolled", level: null, type: "NUMBER", baseline: "0", target: "1,000", isRate: false, ...over }],
  cells, finance: [],
});
const cell = (periodId, periodValue, extra = {}) => ({ indicatorId: "i1", periodId, periodValue, cumulativeValue: "", status: "VERIFIED", ...extra });

test("the latest figure and the one before it are read; a gap is not a zero", () => {
  const s = sheet([cell("p1", "400"), cell("p2", ""), cell("p3", "250")]);
  const input = alertInputFromSheet(s, "i1", { kind: "WORSE_THAN_PREVIOUS" }, "2026-04-02");
  assert.equal(input.current, 250); assert.equal(input.previous, 400); assert.equal(input.target, 1000);
  assert.equal(evaluateAlert({ kind: "WORSE_THAN_PREVIOUS" }, input), "FIRING");
});

test("a no-value rule watches the latest period that has ended, and not applicable is no figure", () => {
  const s = sheet([cell("p1", "5"), cell("p2", "6")]);
  assert.equal(evaluateAlert({ kind: "NO_VALUE" }, alertInputFromSheet(s, "i1", { kind: "NO_VALUE" }, "2026-04-02")), "FIRING");
  assert.equal(evaluateAlert({ kind: "NO_VALUE" }, alertInputFromSheet(s, "i1", { kind: "NO_VALUE" }, "2026-03-15")), "OK");
  const na = sheet([cell("p1", "5"), cell("p2", "", { notApplicable: true })]);
  assert.equal(alertInputFromSheet(na, "i1", { kind: "NO_VALUE" }, "2026-03-15").current, null);
});

test("percent of target reads the cumulative figure and a rate is never judged", () => {
  const s = sheet([cell("p1", "100", { cumulativeValue: "300" })]);
  assert.equal(evaluateAlert({ kind: "BELOW_PERCENT_OF_TARGET", value: 50 }, alertInputFromSheet(s, "i1", { kind: "BELOW_PERCENT_OF_TARGET", value: 50 }, "2026-02-01")), "FIRING");
  const rate = sheet([cell("p1", "40", { cumulativeValue: "40" })], { isRate: true });
  assert.equal(evaluateAlert({ kind: "BELOW_PERCENT_OF_TARGET", value: 50 }, alertInputFromSheet(rate, "i1", { kind: "BELOW_PERCENT_OF_TARGET", value: 50 }, "2026-02-01")), "NO_DATA");
});

test("an unknown indicator reads as nothing and the sentence carries figures only", () => {
  assert.equal(alertInputFromSheet(sheet([]), "zzz", { kind: "BELOW", value: 1 }, "2026-01-01"), null);
  assert.match(describeAlert({ kind: "BELOW", value: 500 }, "Children enrolled", { current: 250 }), /is now 250, below your limit of 500/);
});
