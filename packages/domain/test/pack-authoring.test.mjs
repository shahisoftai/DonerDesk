import assert from "node:assert/strict";
import test from "node:test";
import { parseRequirementLines } from "../dist/index.js";

test("H-10: one requirement per line, with a stable key, mandatory by default and advisory with a trailing ?", () => {
  const { requirements, errors } = parseRequirementLines("# comment\n\nSECTION: Executive summary\nannex: Indicator table\nSECTION: Lessons learned?\n", "USAID Q");
  assert.deepEqual(errors, []);
  assert.deepEqual(requirements.map((r) => [r.key, r.kind, r.required, r.severity]), [
    ["SECTION:executive-summary", "SECTION", true, "BLOCKING"],
    ["ANNEX:indicator-table", "ANNEX", true, "BLOCKING"],
    ["SECTION:lessons-learned", "SECTION", false, "WARNING"],
  ]);
  assert.equal(requirements[0].sourceReference.label, "USAID Q: Executive summary");
});

test("H-10: a bad line is named, in plain words, and the good lines are still read", () => {
  const { requirements, errors } = parseRequirementLines("Executive summary\nSECTION:\nSECTION: A\nSECTION: a\nBANANA: x", "P");
  assert.equal(requirements.length, 1);
  assert.equal(errors.length, 4);
  assert.match(errors[0], /^Line 1: start with one of/);
  assert.match(errors[1], /^Line 2: add a title/);
  assert.match(errors[2], /^Line 4: "a" is listed twice/);
  assert.match(errors[3], /^Line 5: start with one of/);
});
