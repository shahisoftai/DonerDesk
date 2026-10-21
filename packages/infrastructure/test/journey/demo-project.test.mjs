// The demo project on the real stack: it must arrive with a first quarter to report on.
// Opt-in: UOW_VERIFY_DATABASE_URL=postgresql://... node --test test/journey/demo-project.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { TenantId } from "@donordesk/domain";

const url = process.env.UOW_VERIFY_DATABASE_URL;
const skip = url ? false : "set UOW_VERIFY_DATABASE_URL to a migrated scratch database";
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DATABASE_ADMIN_URL = url;
}
const must = (r, what) => { assert.equal(r.ok, true, `${what}: ${r.ok ? "" : r.error.message}`); return r.value; };

test("the demo project has a reporting period, verified values and accepted activities", { skip }, async (t) => {
  const { createContainer } = await import("../../dist/container.js");
  const c = createContainer({ useAdminConnection: true });
  t.after(async () => { await c.settleBackgroundWork(); await c.prisma.$disconnect(); });
  const h = c.handlers;
  const stamp = Date.now();
  const signedUp = must(await h.signUp.handle({
    name: "Demo Admin", email: `demo-${stamp}@example.org`, password: "Correct-Horse-9-Battery",
    organization: { name: `Demo Org ${stamp}`, organizationType: "LOCAL_NGO", country: "Kenya", primarySector: "NUTRITION" },
  }), "sign up");
  const ctx = { tenant: { tenantId: TenantId.create(signedUp.tenantId), userId: signedUp.userId, role: "ADMIN" }, requestId: "demo" };

  const demo = must(await h.createDemoProject.handle(ctx), "create demo");
  assert.equal(demo.reused, false);
  assert.equal(demo.contentNote, undefined, `the first quarter was left out: ${demo.contentNote}`);

  const periods = must(await h.listReportingPeriods.handle(ctx, demo.id), "periods");
  const list = Array.isArray(periods) ? periods : periods.items;
  assert.equal(list.length, 1, "the first quarter exists");
  const grid = must(await h.listPeriodIndicators.handle(ctx, list[0].id), "grid");
  assert.ok(grid.indicators.length >= 2);
  assert.ok(
    grid.indicators.every((i) => i.update && i.update.periodAchievement !== "" && i.update.verificationStatus === "VERIFIED"),
    JSON.stringify(grid.indicators.map((i) => [i.code, i.update?.periodAchievement, i.update?.verificationStatus])),
  );

  const activities = must(await h.listActivities.handle(ctx, demo.id), "activities");
  const items = Array.isArray(activities) ? activities : activities.items;
  assert.equal(items.length, 2);

  // asking again returns the same demo, not a second one
  assert.equal(must(await h.createDemoProject.handle(ctx), "again").reused, true);
});
