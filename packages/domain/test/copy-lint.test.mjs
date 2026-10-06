import assert from "node:assert/strict";
import test from "node:test";
import { findRawTokens, isCleanCopy } from "../dist/index.js";

test("raw codes, ids and keys are found; ordinary words and acronyms are not", () => {
  assert.deepEqual(findRawTokens("The AI timed out (PROVIDER_TIMEOUT)."), [{ kind: "code", token: "PROVIDER_TIMEOUT" }]);
  assert.deepEqual(findRawTokens("See report_section 3f2a9c1e-7b44-4d0e-9a51-0c6d2e8f1a77"), [
    { kind: "uuid", token: "3f2a9c1e-7b44-4d0e-9a51-0c6d2e8f1a77" },
    { kind: "snake_case", token: "report_section" },
  ]);
  for (const clean of ["USAID and PDF exports, 20 April 2028", "Needs a decision", "Sign-offs assigned", "R&D, e.g. HL-1.1b and IND-1"]) {
    assert.equal(isCleanCopy(clean), true, clean);
  }
});
