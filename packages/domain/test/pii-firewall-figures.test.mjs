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

test("an address needs a house number, a few name words and a street word of its own", () => {
  const prose = "AMAN will conduct the assessment of the 10 targeted health facilities using a preparedness tool and checklist adapted from the guide.";
  assert.equal(redactForLlm(prose), prose);
  const multiline = "1\nProject start-up\nPrepare life of project work plan and submit the first draft";
  assert.equal(redactForLlm(multiline), multiline);
  for (const address of ["12 Baker St.", "221 Main Street", "5 Old Mill Road"]) assert.ok(!redactForLlm(`Office at ${address} today`).includes(address), address);
});

test("a caller can keep a kind of entity (a project document's dates)", () => {
  const text = "Revised 29-11-2023, ready by Jul. 31, 2023 or 04/12/2023";
  assert.notEqual(redactForLlm(text), text);
  assert.equal(redactForLlm(text, undefined, ["DATE_OF_BIRTH"]), text);
  assert.ok(!redactForLlm("Mail a@b.org 29-11-2023", undefined, ["DATE_OF_BIRTH"]).includes("a@b.org"));
});

test("an amount with four decimals is not a phone number, while real phone shapes still are", () => {
  assert.equal(redactForLlm("Cost\t567282.9617\t10"), "Cost\t567282.9617\t10");
  assert.match(redactForLlm("Call 555.123.4567 or 5551234567"), /^Call \[REDACTED\] or \[REDACTED\]$/);
});
