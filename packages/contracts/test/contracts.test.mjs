import assert from "node:assert/strict";
import test from "node:test";
import { LoginSchema, SignUpSchema, OrganizationProfileSchema } from "../dist/index.js";

test("authentication contracts reject malformed edge input", () => {
  assert.equal(LoginSchema.safeParse({ email: "not-an-email", password: "x" }).success, false);
  assert.equal(SignUpSchema.safeParse({}).success, false);
});

test("organization contracts validate data residency", () => {
  const signup = SignUpSchema.parse({
    name: "Admin User", email: "admin@example.org", password: "Correct-Horse-9-Battery",
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

test("consent is accepted from every place the web records it (invitation was once rejected, silently)", async () => {
  const { RecordConsentSchema, CONSENT_SOURCES } = await import("../dist/index.js");
  for (const source of ["onboarding", "invitation"]) assert.ok(CONSENT_SOURCES.includes(source), source);
  for (const source of CONSENT_SOURCES) assert.equal(RecordConsentSchema.safeParse({ accepted: true, source }).success, true, source);
  assert.equal(RecordConsentSchema.safeParse({ accepted: true }).data.source, "onboarding");
  assert.equal(RecordConsentSchema.safeParse({ accepted: false }).success, false);
});
