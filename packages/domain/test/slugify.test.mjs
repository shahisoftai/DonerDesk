import test from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../dist/core/slugify.js";

test("slugify keeps lower-case letters and digits, joined by single hyphens", () => {
  assert.equal(slugify("Learning Recovery for Displaced Children"), "learning-recovery-for-displaced-children");
  assert.equal(slugify("  --Annex A (2026)!  "), "annex-a-2026");
  assert.equal(slugify("a___b...c"), "a-b-c");
});

test("slugify gives an empty string when nothing usable is left", () => {
  assert.equal(slugify(""), "");
  assert.equal(slugify("***"), "");
  assert.equal(slugify("طلب"), "");
});
