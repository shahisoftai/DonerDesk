import { test } from "node:test";
import assert from "node:assert/strict";
import { isSafeRedirect, safeRedirect } from "../../src/lib/shared/navigation.ts";

test("isSafeRedirect accepts local paths", () => {
  assert.equal(isSafeRedirect("/dashboard"), true);
  assert.equal(isSafeRedirect("/projects/abc?tab=1"), true);
});

test("isSafeRedirect rejects unsafe targets", () => {
  assert.equal(isSafeRedirect(null), false);
  assert.equal(isSafeRedirect(""), false);
  assert.equal(isSafeRedirect("https://evil.com"), false);
  assert.equal(isSafeRedirect("//evil.com"), false);
});

test("safeRedirect falls back", () => {
  assert.equal(safeRedirect(null), "/dashboard");
  assert.equal(safeRedirect("https://evil.com"), "/dashboard");
  assert.equal(safeRedirect("/team"), "/team");
});
