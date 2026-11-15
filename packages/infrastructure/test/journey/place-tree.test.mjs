// Phase 56 on the real stack: one place tree, two projects, one village. Footprints are per project, an area with records cannot be
// unticked (it can be closed), a completed activity inherits its plan's places, a typed word is confirmed once, the organisation's map is
// derived, and a merge moves every link in one transaction. Row-level security keeps another organisation out of every new table.
// Opt-in: UOW_VERIFY_DATABASE_URL=postgresql://... (a migrated scratch database)
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

test("journey: one place tree across two projects", { skip }, async (t) => {
  const { createContainer } = await import("../../dist/container.js");
  const c = createContainer({ useAdminConnection: true });
  t.after(async () => { await c.settleBackgroundWork(); await c.prisma.$disconnect(); });
  const h = c.handlers;
  const stamp = Date.now();
  const signedUp = must(await h.signUp.handle({ name: "Places Admin", email: `places-${stamp}@example.org`, password: "Correct-Horse-9-Battery", organization: { name: `Places Org ${stamp}`, organizationType: "LOCAL_NGO", country: "Kenya", primarySector: "WASH" } }), "sign up");
  await c.prisma.entitlementGrant.create({ data: { id: `eg-${stamp}`, tenantId: signedUp.tenantId, planCode: "ENTERPRISE", source: "MANUAL", effectiveFrom: new Date(Date.now() - 1000), reason: "places journey" } });
  const tenantId = TenantId.create(signedUp.tenantId);
  const ctx = { tenant: { tenantId, userId: signedUp.userId, role: "ADMIN" }, requestId: "places-journey" };
  const newProject = async (code) => must(await h.createProject.handle(ctx, { title: `Project ${code}`, projectCode: `${code}-${stamp}`, donorName: "Donor", implementingOrganization: "Org", country: "Kenya", sector: "WASH", startDate: "2026-01-01T00:00:00.000Z", endDate: "2026-12-31T00:00:00.000Z", reportingFrequency: "MONTHLY" }), code);
  const p1 = await newProject("WASH");
  const p2 = await newProject("HEALTH");
  const out = must(await h.createLogframeItem.handle(ctx, { projectId: p1.id, level: "OUTPUT", code: "O1", title: "Water points" }), "output");
  const ind = must(await h.createIndicator.handle(ctx, { projectId: p1.id, logframeItemId: out.id, code: "I1", name: "People served", type: "NUMBER", baseline: "0", target: "100", unit: "people", frequency: "Monthly", disaggregationRequired: false }), "indicator");
  const setup = must(await h.acknowledgeProjectSetup.handle(ctx, p1.id), "setup confirmed");
  assert.equal(setup.readiness.ready, true, JSON.stringify(setup.readiness.blockers));

  // Areas come from the built-in boundaries on first use; the same area is one place for both projects.
  const pick = (name, ref, level, parentRef) => ({ ref, level, name, ...(parentRef ? { parentRef } : {}) });
  const units = [pick("Province A", "pa", 1), pick("District A1", "a1", 2, "pa")];
  const a1 = must(await h.tickProjectArea.handle(ctx, p1.id, { country: { name: "Kenya" }, units, targetRef: "a1" }), "tick A1 on P1").placeId;
  const a1Again = must(await h.tickProjectArea.handle(ctx, p2.id, { country: { name: "Kenya" }, units, targetRef: "a1" }), "tick A1 on P2").placeId;
  assert.equal(a1Again, a1, "one district, one place");
  const a2 = must(await h.tickProjectArea.handle(ctx, p1.id, { country: { name: "Kenya" }, units: [pick("Province A", "pa", 1), pick("District A2", "a2", 2, "pa")], targetRef: "a2" }), "tick A2").placeId;
  assert.equal((await h.tickProjectArea.handle(ctx, p1.id, { placeId: a1 })).ok, false, "a repeat is refused");

  // Ticking on one project never shows on the other.
  const v1 = must(await h.listProjectPlaces.handle(ctx, p1.id), "P1 places");
  const v2 = must(await h.listProjectPlaces.handle(ctx, p2.id), "P2 places");
  assert.deepEqual(v1.areas.map((a) => a.id).sort(), [a1, a2].sort());
  assert.deepEqual(v2.areas.map((a) => a.id), [a1]);

  // A village added inline sits under its district.
  const village = must(await h.addPlaceInline.handle(ctx, p1.id, { name: "Village 1", parent: { placeId: a1 } }), "add village");
  assert.equal(village.existed, false);
  assert.match(village.place.path, /^Village 1 › District A1/);
  const again = must(await h.addPlaceInline.handle(ctx, p2.id, { name: "village 1", parent: { placeId: a1 } }), "same village again");
  assert.equal(again.existed, true, "a repeat under the same parent is the same place");
  assert.equal(again.place.id, village.place.id);

  // A planned activity at the village; its completed activity inherits the place.
  const planned = must(await h.createPlannedActivity.handle(ctx, p1.id, { title: "Repair handpump", plannedStart: "2026-03-01", plannedEnd: "2026-03-31", supportUserIds: [], location: "Vilage One" }), "plan item").ids[0];
  must(await h.setPlanPlaces.handle(ctx, planned, { placeIds: [village.place.id] }), "plan places");
  const period = must(await h.createReportingPeriod.handle(ctx, { projectId: p1.id, reportType: "MONTHLY", startDate: "2026-03-01T00:00:00.000Z", endDate: "2026-03-31T00:00:00.000Z", deadline: "2026-04-15T00:00:00.000Z", useBuiltInStructure: true }), "period");
  const done = must(await h.createActivityUpdate.handle(ctx, { projectId: p1.id, reportingPeriodId: period.id, activityTitle: "Handpump repaired", activityDate: "2026-03-10T00:00:00.000Z", plannedActivityId: planned, summary: "Repaired." }), "completed activity");
  const doneView = must(await h.getRecordPlaces.handle(ctx, p1.id, "ACTIVITY", done.id), "activity places");
  assert.deepEqual(doneView.places.map((p) => [p.id, p.source]), [[village.place.id, "INHERITED"]]);
  assert.equal(doneView.inherited, false, "stored, not only shown");

  // An area with records cannot be unticked; it can be closed and reopened.
  const refused = await h.untickProjectArea.handle(ctx, p1.id, a1);
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /1 planned activity and 1 completed activity/);
  must(await h.setProjectAreaOpen.handle(ctx, p1.id, a1, { open: false, reason: "Funding ended" }), "close");
  const closed = must(await h.listProjectPlaces.handle(ctx, p1.id), "after close");
  assert.equal(closed.areas.find((a) => a.id === a1).closed, true);
  assert.ok(!closed.forNewWork.includes(village.place.id), "a closed area is not offered for new work");
  must(await h.setProjectAreaOpen.handle(ctx, p1.id, a1, { open: true }), "reopen");
  must(await h.untickProjectArea.handle(ctx, p1.id, a2), "an empty area can be unticked");

  // A typed word is confirmed once: the plan item that carried it gets the link and the word leaves the list.
  const before = must(await h.listProjectPlaces.handle(ctx, p1.id), "words before");
  assert.ok(before.unconfirmed.some((w) => w.text === "Vilage One"));
  must(await h.confirmPlaceWord.handle(ctx, p1.id, { word: "Vilage One", placeId: village.place.id }), "confirm word");
  const after = must(await h.listProjectPlaces.handle(ctx, p1.id), "words after");
  assert.ok(!after.unconfirmed.some((w) => w.text === "Vilage One"));

  // The organisation's map: District A1 has both projects, and the village's work counts there.
  const map = must(await h.getWhereWeWork.handle(ctx, { level: 2 }), "where we work");
  const row = map.areas.find((a) => a.id === a1);
  assert.deepEqual(row.projects.map((p) => p.id).sort(), [p1.id, p2.id].sort());
  assert.equal(row.activities, 1);
  const profile = must(await h.getPlaceProfile.handle(ctx, village.place.id), "place page");
  // P1 worked there; P2 covers its district: both are listed, only P1 with work.
  assert.deepEqual(profile.projects.map((p) => [p.id, p.covers, p.activities]).sort(), [[p1.id, true, 1], [p2.id, true, 0]].sort());

  // Where an indicator is measured: chosen places, then rows.
  must(await h.setIndicatorPlaces.handle(ctx, ind.id, { scope: "CHOSEN", placeIds: [village.place.id] }), "measure at chosen places");
  const rows = must(await h.getIndicatorPlaces.handle(ctx, ind.id), "rows");
  assert.deepEqual(rows.rows.map((r) => r.placeId), [village.place.id]);

  // A merge moves every link and leaves the old id resolving.
  const dup = must(await h.createPlace.handle(ctx, { name: "Village One", kind: "POINT", adminLevel: 4, parentId: a1, aliases: [] }), "duplicate");
  must(await h.setRecordPlaces.handle(ctx, p1.id, "ACTIVITY", done.id, { placeIds: [dup.id] }), "point the activity at the duplicate");
  const merged = must(await h.mergePlaces.handle(ctx, { keepId: village.place.id, mergeId: dup.id }), "merge");
  assert.ok(merged.moved >= 1);
  const moved = must(await h.getRecordPlaces.handle(ctx, p1.id, "ACTIVITY", done.id), "after merge");
  assert.deepEqual(moved.places.map((p) => p.id), [village.place.id]);

  // Another organisation sees none of it: row-level security on every new table.
  for (const table of ["ProjectArea", "ActivityUpdatePlace", "PlaceWordLink"]) {
    const rls = await c.prisma.$queryRawUnsafe(`select relrowsecurity, relforcerowsecurity from pg_class where relname = '${table}'`);
    assert.deepEqual(rls, [{ relrowsecurity: true, relforcerowsecurity: true }], `${table} must force row-level security`);
  }
});
