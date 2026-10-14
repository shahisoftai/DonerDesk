import test from "node:test";
import assert from "node:assert/strict";
import { scopeNotMeasured } from "../dist/index.js";

const f = (code, frequency) => ({ indicatorId: code, indicatorCode: code, indicatorName: code, ...(frequency ? { frequency } : {}) });
const window = (end, isFinalPeriod = false) => ({ projectStart: new Date("2026-02-01"), periodEnd: new Date(end), isFinalPeriod });

test("a quarterly survey in a month it is not due is not reported as 'not measured'", () => {
  const out = scopeNotMeasured([f("MONTHLY1", "Monthly"), f("QSURVEY", "Quarterly")], [], window("2026-03-31"));
  assert.deepEqual(out.map((x) => x.indicatorCode), ["MONTHLY1"]);
});

test("the same survey is listed when it falls due and nothing was entered", () => {
  const out = scopeNotMeasured([f("QSURVEY", "Quarterly")], [], window("2026-04-30"));
  assert.deepEqual(out.map((x) => x.indicatorCode), ["QSURVEY"]);
});

test("an annual indicator is due in the final period; an unknown frequency means every period", () => {
  assert.equal(scopeNotMeasured([f("IMPACT", "Annual")], [], window("2026-08-31")).length, 0);
  assert.equal(scopeNotMeasured([f("IMPACT", "Annual")], [], window("2026-09-30", true)).length, 1);
  assert.equal(scopeNotMeasured([f("X", "whenever")], [], window("2026-03-31")).length, 1);
});

test("an indicator that has a reported figure is never listed", () => {
  assert.equal(scopeNotMeasured([f("A", "Monthly")], [f("A", "Monthly")], window("2026-03-31")).length, 0);
});
