import assert from "node:assert/strict";
import test from "node:test";
import { isTruthyFlag } from "../dist/observability/feature-flags.js";

test("isTruthyFlag accepts canonical truthy strings (case-insensitive)", () => {
  for (const v of ["1", "true", "TRUE", "yes", "Yes", "on", "ON", "enabled", "ENABLED"]) {
    assert.equal(isTruthyFlag(v), true, `expected "${v}" to be truthy`);
  }
});

test("isTruthyFlag rejects falsy and empty values", () => {
  for (const v of [undefined, null, "", "0", "false", "no", "off", "disabled", "  "]) {
    assert.equal(isTruthyFlag(v), false, `expected "${String(v)}" to be falsy`);
  }
});

test("isTruthyFlag tolerates surrounding whitespace", () => {
  assert.equal(isTruthyFlag("  true  "), true);
  assert.equal(isTruthyFlag(" yes "), true);
});