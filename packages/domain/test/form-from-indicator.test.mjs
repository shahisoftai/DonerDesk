import assert from "node:assert/strict";
import test from "node:test";
import { formFromIndicator, validateFormDefinition } from "../dist/index.js";

const base = { id: "ind-1", code: "OUT-1.1", name: "People trained", unit: "people", aggregation: "SUM" };

test("a summing indicator gets a form that adds its records up by their date", () => {
  const d = formFromIndicator(base);
  assert.equal(d.ok, true);
  assert.deepEqual(d.mappings, [{ indicatorId: "ind-1", method: "SUM", valueField: "value", dateField: "date" }]);
  assert.deepEqual(d.fields.map((f) => f.key), ["date", "value", "place", "note"]);
  assert.equal(d.fields.find((f) => f.key === "value").label, "Number of people");
  assert.deepEqual(validateFormDefinition({ fields: d.fields }), []);
});

test("the unit names what is counted, with a plain default", () => {
  assert.equal(formFromIndicator({ ...base, unit: "households" }).fields[1].label, "Number of households");
  assert.equal(formFromIndicator({ ...base, unit: undefined }).fields[1].label, "Number of people");
});

test("a rate, a latest reading or a calculated value is not made of records: no form, and the reason is plain", () => {
  for (const aggregation of ["PERCENTAGE", "RATIO", "LATEST", "AVERAGE"]) {
    const d = formFromIndicator({ ...base, aggregation });
    assert.equal(d.ok, false);
    assert.match(d.reason, /Enter its value directly/);
  }
  const calc = formFromIndicator({ ...base, isCalculated: true });
  assert.equal(calc.ok, false);
  assert.match(calc.reason, /calculated/);
});

test("a long indicator name still gives a form name that fits a list", () => {
  const d = formFromIndicator({ ...base, name: "x".repeat(300) });
  assert.ok(d.name.length <= 120);
});
