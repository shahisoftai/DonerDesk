// The core reporting workflow on the real stack: real container, real Postgres, no in-memory fakes.
// Opt-in: needs a migrated scratch database.  UOW_VERIFY_DATABASE_URL=postgresql://... pnpm test:journey-db
import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { TenantId } from "@donordesk/domain";

const url = process.env.UOW_VERIFY_DATABASE_URL;
const skip = url ? false : "set UOW_VERIFY_DATABASE_URL to a migrated scratch database";
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DATABASE_ADMIN_URL = url;
}
const must = (r, what) => { assert.equal(r.ok, true, `${what}: ${r.ok ? "" : r.error.message}`); return r.value; };

test("journey: sign up, project, framework, period, values, verification, framework history, lock after approval, export", { skip }, async (t) => {
  const { createContainer } = await import("../../dist/container.js");
  const c = createContainer({ useAdminConnection: true });
  t.after(async () => { await c.settleBackgroundWork(); await c.prisma.$disconnect(); });
  const h = c.handlers;
  const stamp = Date.now();

  // 1. A new organisation signs up.
  const signedUp = must(await h.signUp.handle({
    name: "Journey Admin", email: `journey-${stamp}@example.org`, password: "Correct-Horse-9-Battery",
    organization: { name: `Journey Org ${stamp}`, organizationType: "LOCAL_NGO", country: "Kenya", primarySector: "WASH" },
  }), "sign up");
  const ctx = { tenant: { tenantId: TenantId.create(signedUp.tenantId), userId: signedUp.userId, role: "ADMIN" }, requestId: "journey" };

  // 2. A project, with a result and an indicator under it.
  const project = must(await h.createProject.handle(ctx, {
    title: "Clean Water Journey", projectCode: `CWJ-${stamp}`, donorName: "Test Donor", implementingOrganization: "Journey Org", country: "Kenya", sector: "WASH",
    startDate: "2026-01-01T00:00:00.000Z", endDate: "2026-12-31T00:00:00.000Z", reportingFrequency: "MONTHLY",
  }), "create project");
  const output = must(await h.createLogframeItem.handle(ctx, { projectId: project.id, level: "OUTPUT", code: "OUT-1", title: "Wells rehabilitated" }), "create output");
  const indicator = must(await h.createIndicator.handle(ctx, {
    projectId: project.id, logframeItemId: output.id, code: "IND-1", name: "Wells rehabilitated", type: "NUMBER", baseline: "0", target: "100", unit: "wells", frequency: "Monthly", disaggregationRequired: false,
  }), "create indicator");

  // 3. Every framework change left a version, and the target change reads as a plain sentence.
  let versions = must(await h.listLogframeVersions.handle(ctx, project.id), "list versions").items;
  assert.ok(versions.length >= 2, `expected a version per change, got ${versions.length}`);
  must(await h.updateIndicator.handle(ctx, { indicatorId: indicator.id, target: "120" }), "raise the target");
  versions = must(await h.listLogframeVersions.handle(ctx, project.id), "list versions again").items;
  const changes = must(await h.getLogframeChanges.handle(ctx, project.id, versions[0].version), "changes");
  assert.ok(changes.changes.some((x) => x.text === "Indicator IND-1: target changed from 100 to 120"), JSON.stringify(changes.changes));

  // 4. The project is set up (the person confirms it), then a monthly period opens.
  const setup = must(await h.acknowledgeProjectSetup.handle(ctx, project.id), "acknowledge setup");
  assert.equal(setup.readiness.ready, true, `project not ready: ${JSON.stringify(setup.readiness.blockers)}`);
  // 4b. A monthly period; a value is entered and verified.
  const period = must(await h.createReportingPeriod.handle(ctx, {
    projectId: project.id, reportType: "MONTHLY", startDate: "2026-03-01T00:00:00.000Z", endDate: "2026-03-31T00:00:00.000Z", deadline: "2026-04-15T00:00:00.000Z", useBuiltInStructure: true,
  }), "create period");
  const saved = must(await h.bulkUpsertIndicatorUpdates.handle(ctx, { reportingPeriodId: period.id, updates: [{ indicatorId: indicator.id, periodAchievement: "40", cumulativeAchievement: "40" }] }), "enter value");
  assert.equal(saved.saved, 1);
  const verified = must(await h.verifyPeriodIndicatorUpdates.handle(ctx, { reportingPeriodId: period.id }), "verify");
  assert.ok(verified.verified >= 1, JSON.stringify(verified));
  const grid = must(await h.listPeriodIndicators.handle(ctx, period.id), "grid");
  const row = grid.indicators.find((i) => i.code === "IND-1");
  assert.equal(row.update.periodAchievement, "40");
  assert.equal(row.update.verificationStatus, "VERIFIED");

  // 5. Approval locks the figures; the lock says how to correct them.
  const stored = must(await c.periods.findById(period.id, ctx.tenant.tenantId), "load period");
  stored.advanceStatus("APPROVED");
  must(await c.periods.update(stored), "approve period");
  const locked = await h.bulkUpsertIndicatorUpdates.handle(ctx, { reportingPeriodId: period.id, updates: [{ indicatorId: indicator.id, periodAchievement: "99", cumulativeAchievement: "99" }] });
  assert.equal(locked.ok, false);
  assert.match(locked.error.message, /Reopen the report/);

  // 6. The audit trail holds the work, in an unbroken chain.
  const trail = must(await c.audits.listByTenant(ctx.tenant.tenantId, { limit: 200 }), "audit");
  const types = new Set(trail.map((e) => e.eventType));
  for (const expected of ["project.created", "logframe.indicator.updated"]) assert.ok(types.has(expected), `audit is missing ${expected}`);
  assert.deepEqual(await c.audits.verifyChain(ctx.tenant.tenantId), { valid: true });

  // 7. The organisation can take its data with it.
  const exported = must(await h.exportOrganization.handle(ctx, { includeFiles: false }), "export");
  const chunks = [];
  for await (const chunk of exported.stream) chunks.push(chunk);
  const zip = await JSZip.loadAsync(Buffer.concat(chunks));
  assert.ok((await zip.file("data/Project.ndjson").async("string")).includes("Clean Water Journey"));
  assert.ok((await zip.file("data/IndicatorUpdate.ndjson").async("string")).includes('"periodAchievement":"40"'));
  assert.ok(!(await zip.file("data/User.ndjson").async("string")).includes("passwordHash"));
});
