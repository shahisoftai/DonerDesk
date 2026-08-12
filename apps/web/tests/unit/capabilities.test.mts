import { test } from "node:test";
import assert from "node:assert/strict";
import { capabilitiesForRole, can, ROLES } from "../../src/lib/shared/capabilities.ts";

test("unknown role gets no capabilities", () => {
  assert.equal(capabilitiesForRole(undefined).size, 0);
  assert.equal(capabilitiesForRole("NOT_A_ROLE").size, 0);
});

test("VIEWER has no capabilities", () => {
  assert.equal(capabilitiesForRole("VIEWER").size, 0);
});

test("FIELD_OFFICER can create activities and upload evidence only", () => {
  const caps = capabilitiesForRole("FIELD_OFFICER");
  assert.equal(can(caps, "activity.create"), true);
  assert.equal(can(caps, "evidence.upload"), true);
  assert.equal(can(caps, "report.approve"), false);
  assert.equal(can(caps, "audit.view"), false);
});

test("ADMIN has every capability", () => {
  const caps = capabilitiesForRole("ADMIN");
  for (const role of ROLES) {
    for (const c of capabilitiesForRole(role)) {
      assert.equal(caps.has(c), true, `ADMIN missing ${c}`);
    }
  }
});

test("can works with a plain array", () => {
  assert.equal(can(["activity.create"], "activity.create"), true);
  assert.equal(can(["activity.create"], "evidence.verify"), false);
});
