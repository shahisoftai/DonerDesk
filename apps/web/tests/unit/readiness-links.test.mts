import { test } from "node:test";
import assert from "node:assert/strict";
import { blockerHref } from "../../src/lib/shared/readiness-links.ts";

test("blockerHref resolves a readiness blocker's bare path under the current project", () => {
  assert.equal(blockerHref("proj-1", "/templates"), "/projects/proj-1/templates");
  assert.equal(blockerHref("proj-1", "/logframe"), "/projects/proj-1/logframe");
  assert.equal(blockerHref("proj-1", "/team"), "/projects/proj-1/team");
});

test("blockerHref sends /reporting-profile to the actual setup page, not a nonexistent top-level route", () => {
  assert.equal(blockerHref("proj-1", "/reporting-profile"), "/projects/proj-1/setup/profile");
});

test("blockerHref leaves an already-absolute or external href alone", () => {
  assert.equal(blockerHref("proj-1", "https://example.com/help"), "https://example.com/help");
});
