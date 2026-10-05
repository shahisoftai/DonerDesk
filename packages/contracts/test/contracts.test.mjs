import assert from "node:assert/strict";
import test from "node:test";
import { LoginSchema, SignUpSchema, OrganizationProfileSchema } from "../dist/index.js";

test("authentication contracts reject malformed edge input", () => {
  assert.equal(LoginSchema.safeParse({ email: "not-an-email", password: "x" }).success, false);
  assert.equal(SignUpSchema.safeParse({}).success, false);
});

test("organization contracts validate data residency", () => {
  const signup = SignUpSchema.parse({
    name: "Admin User", email: "admin@example.org", password: "password123",
    organization: { name: "Example NGO", organizationType: "LOCAL_NGO", country: "PK", primarySector: "WASH" },
  });
  assert.equal(signup.organization.dataResidency, "DEFAULT");
  assert.equal(signup.organization.aiEnabled, true);
  assert.equal(OrganizationProfileSchema.safeParse({ dataResidency: "MOON" }).success, false);
});

test("authentication contracts normalize valid email input", () => {
  const parsed = LoginSchema.parse({ email: "admin@example.org", password: "password123" });
  assert.equal(parsed.email, "admin@example.org");
});

import { AttachEvidenceSchema } from "../dist/index.js";

test("attach-evidence accepts the clear indicatorUpdateId name and the legacy indicatorId alias", () => {
  assert.deepEqual(AttachEvidenceSchema.parse({ evidenceId: "e1", indicatorUpdateId: "u1" }), { evidenceId: "e1", indicatorId: "u1" });
  assert.deepEqual(AttachEvidenceSchema.parse({ evidenceId: "e1", indicatorId: "u1" }), { evidenceId: "e1", indicatorId: "u1" });
  assert.deepEqual(AttachEvidenceSchema.parse({ evidenceId: "e1", activityId: "a1" }), { evidenceId: "e1", activityId: "a1", indicatorId: undefined });
});
