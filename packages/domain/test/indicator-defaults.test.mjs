import test from "node:test";
import assert from "node:assert/strict";
import { suggestIndicatorSetup } from "../dist/index.js";

const s = (title, extra = {}) => suggestIndicatorSetup({ title, type: null, unit: null, target: null, ...extra });

test("deaths, defaulting and non-response read as lower-is-better, with a reason", () => {
  for (const t of ["OTP death rate", "Children who defaulted from OTP", "OTP default rate", "OTP non-response rate", "Children non-recovered (non-response) in SFP", "Stock-out days at stores"]) {
    const r = s(t);
    assert.equal(r.direction?.value, "LOWER", t);
    assert.ok(r.direction.reason.length > 10);
  }
});

test("work done and people reached read as higher-is-better", () => {
  for (const t of ["Children 6-59 months screened for acute malnutrition", "OTP cure rate", "Functional OTP sites", "IYCF sessions held", "RUTF cartons received"]) assert.equal(s(t).direction?.value, "HIGHER", t);
});

test("a title it cannot judge gets no direction (never a guess)", () => {
  assert.equal(s("Community resilience index").direction, null);
});

test("lower words win over higher words", () => {
  assert.equal(s("Children who died after being admitted").direction?.value, "LOWER");
});

test("type: a rate or % is a percentage; a plain numeric target is a number; a chosen type is left alone", () => {
  assert.equal(s("OTP cure rate").type?.value, "PERCENTAGE");
  assert.equal(s("Children screened", { target: "150,000" }).type?.value, "NUMBER");
  assert.equal(s("Coverage", { unit: "%" }).type?.value, "PERCENTAGE");
  assert.equal(s("Children screened", { type: "NUMBER", target: "10" }).type, null);
  assert.equal(s("Something", { target: "high" }).type, null);
});
