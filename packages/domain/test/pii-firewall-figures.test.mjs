import test from "node:test";
import assert from "node:assert/strict";
import { redactForLlm } from "../dist/index.js";

// A project document is full of figures that look like phone numbers to a greedy pattern: they must reach the model intact
// (and the grounding check reads the same text), while real phone numbers are still hidden.
test("years, tabbed amounts and decimals are not phone numbers", () => {
  for (const text of ["a three-year (2021-2024) initiative", "Personnel\t\t19015000\t19015000", "Indirect 5661165.9617 5661165.9617", "TOTAL 62272809.4617", "July 2023 - April 2024"]) {
    assert.equal(redactForLlm(text), text);
  }
});

test("phone numbers in common shapes are still hidden", () => {
  for (const phone of ["+1 555 0100", "+92 300 1234567", "0300-1234567", "(091) 123 4567", "555 123 4567", "5551234567", "021-3456789"]) {
    assert.ok(!redactForLlm(`Call ${phone} today`).includes(phone), phone);
  }
});
