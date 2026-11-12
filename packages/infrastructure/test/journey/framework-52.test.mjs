// Phase 52 on the real stack: donor wording, a result's logic, the two lenses, and what may change after sign-off.
// Opt-in: UOW_VERIFY_DATABASE_URL=postgresql://... (a scratch database migrated with 20261116090000..110000)
import assert from "node:assert/strict";
import test from "node:test";
import { TenantId, presetVocabulary } from "@donordesk/domain";

const url = process.env.UOW_VERIFY_DATABASE_URL;
const skip = url ? false : "set UOW_VERIFY_DATABASE_URL to a migrated scratch database";
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";
if (url) { process.env.DATABASE_URL = url; process.env.DATABASE_ADMIN_URL = url; }
const must = (r, what) => { assert.equal(r.ok, true, `${what}: ${r.ok ? "" : r.error.message}`); return r.value; };

test("journey: wording, logic, lenses, version kinds and the post-approval rules persist through Postgres", { skip }, async (t) => {
  const { createContainer } = await import("../../dist/container.js");
  const c = createContainer({ useAdminConnection: true });
  t.after(async () => { await c.settleBackgroundWork(); await c.prisma.$disconnect(); });
  const h = c.handlers;
  const stamp = Date.now();
  const signedUp = must(await h.signUp.handle({ name: "Framework Admin", email: `fw-${stamp}@example.org`, password: "Correct-Horse-9-Battery", organization: { name: `Framework Org ${stamp}`, organizationType: "LOCAL_NGO", country: "Kenya", primarySector: "WASH" } }), "sign up");
  const ctx = { tenant: { tenantId: TenantId.create(signedUp.tenantId), userId: signedUp.userId, role: "ADMIN" }, requestId: "fw" };
  const project = must(await h.createProject.handle(ctx, { title: "Framework Journey", projectCode: `FW-${stamp}`, donorName: "Donor", implementingOrganization: "Org", country: "Kenya", sector: "WASH", startDate: "2026-01-01T00:00:00.000Z", endDate: "2026-12-31T00:00:00.000Z", reportingFrequency: "MONTHLY" }), "project");

  // Wording is stored and read back through the profile.
  must(await h.setFrameworkVocabulary.handle(ctx, project.id, presetVocabulary("USAID")), "set wording");
  const profile = must(await h.getReportingProfile.handle(ctx, project.id), "profile");
  assert.equal(profile.profile.vocabulary.levels.OUTCOME, "Intermediate Result");

  // A result with logic; the snapshot carries it and a change to it is a change to the results.
  const outcome = must(await h.createLogframeItem.handle(ctx, { projectId: project.id, level: "OUTCOME", code: "1", title: "Better feeding", rationale: "Feeding lowers wasting", assumptions: "Food is available" }), "outcome");
  const output = must(await h.createLogframeItem.handle(ctx, { projectId: project.id, level: "OUTPUT", code: "1.1", title: "Sessions held", parentId: outcome.id }), "output");
  const indicator = must(await h.createIndicator.handle(ctx, { projectId: project.id, logframeItemId: output.id, code: "IND-1", name: "Caregivers counselled", type: "NUMBER", baseline: "0", target: "500", unit: "people", frequency: "Monthly", disaggregationRequired: false }), "indicator");
  must(await h.updateLogframeItem.handle(ctx, outcome.id, { assumptions: "Food and clinics are available" }), "edit assumption");
  const listed = must(await h.listLogframe.handle(ctx, project.id), "list");
  assert.equal(listed.items.find((i) => i.id === outcome.id).assumptions, "Food and clinics are available");
  let versions = must(await h.listLogframeVersions.handle(ctx, project.id), "versions").items;
  assert.deepEqual(versions[0].kinds, ["STRUCTURE"]);
  assert.deepEqual(versions.at(-1).kinds, [], "the first version is a baseline");

  // Both lenses, in the donor's words.
  const logframe = must(await h.getFrameworkDocument.handle(ctx, project.id, "LOGFRAME"), "logframe lens");
  assert.equal(logframe.title, "Results Framework");
  assert.ok(logframe.rows.some((r) => r.cells.level === "Intermediate Result" && r.cells.assumptions === "Food and clinics are available"));
  const results = must(await h.getFrameworkDocument.handle(ctx, project.id, "RESULTS"), "results lens");
  assert.equal(results.rows.some((r) => r.kind === "INDICATOR" && r.cells.baseline !== undefined), false);

  // After sign-off a code is fixed; a target nobody's report used may still be corrected, and the version is a measurement change.
  must(await h.approveLogframeVersion.handle(ctx, project.id), "sign off");
  const renamed = await h.updateIndicator.handle(ctx, { indicatorId: indicator.id, code: "IND-9" });
  assert.equal(renamed.ok, false);
  assert.equal(renamed.error.details.code, "CODE_LOCKED");
  must(await h.updateIndicator.handle(ctx, { indicatorId: indicator.id, target: "600" }), "correct the target");
  versions = must(await h.listLogframeVersions.handle(ctx, project.id), "versions again").items;
  assert.deepEqual(versions[0].kinds, ["MEASUREMENT"]);

  // A problem can be raised against a result of this project, and not against another's.
  must(await h.createRisk.handle(ctx, project.id, { kind: "RISK", title: "Clinics may close", seriousness: "HIGH", action: "", logframeItemId: outcome.id }), "risk against a result");
  const bad = await h.createRisk.handle(ctx, project.id, { kind: "RISK", title: "Wrong", seriousness: "LOW", action: "", logframeItemId: "not-a-result" });
  assert.equal(bad.ok, false);
});
