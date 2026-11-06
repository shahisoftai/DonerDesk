import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { GetProjectPlaceResultsHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "u", role: "VIEWER" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const day = (d) => new Date(`${d}T00:00:00Z`);
const place = (id, name, adminLevel, parentId) => ({ id, tenantId, name, kind: "AREA", adminLevel, ...(parentId ? { parentId } : {}), aliases: [], archived: false, createdById: "u" });
const entry = (category, value) => ({ dimension: "LOCATION", category, value });

function handler({ places, updates }) {
  return new GetProjectPlaceResultsHandler(
    { findById: async () => ok({ archivedAt: null, country: "Sudan" }) },
    { findByProject: async () => ok([{ id: "p1", duration: { start: day("2026-11-01"), end: day("2026-11-30") } }, { id: "p2", duration: { start: day("2026-12-01"), end: day("2026-12-31") } }]) },
    { findByProject: async () => ok([
      { id: "i1", code: "OC1", name: "Children vaccinated", type: "NUMBER", unit: "children" },
      { id: "i2", code: "OC2", name: "Coverage", type: "PERCENTAGE", unit: "%" },
      { id: "i3", code: "OC3", name: "No breakdown", type: "NUMBER", unit: null },
    ]) },
    { findByReportingPeriods: async (ids) => ok(updates.filter((u) => ids.includes(u.reportingPeriodId))) },
    { list: async () => ok(places) },
  );
}
const upd = (indicatorId, reportingPeriodId, entries, status = "VERIFIED") => ({ indicatorId, reportingPeriodId, periodAchievement: "0", cumulativeAchievement: "0", verificationStatus: status, disaggregation: entries });
const PLACES = [place("sd", "Sudan", 0), place("wn", "White Nile", 1, "sd"), place("rabak", "Rabak", 2, "wn"), place("kosti", "Kosti", 2, "wn")];

test("each indicator is read at the chosen level; indicators with no location breakdown are listed apart, not as zero", async () => {
  const r = await handler({ places: PLACES, updates: [
    upd("i1", "p1", [entry("Rabak", "70"), entry("Kosti", "10")]), upd("i1", "p2", [entry("Rabak", "30")]),
    upd("i2", "p1", [entry("Rabak", "80")]), upd("i3", "p1", []),
  ] }).handle(ctx, "proj", 1);
  assert.ok(r.ok);
  assert.deepEqual(r.value.levelsAvailable, [0, 1, 2]);
  assert.equal(r.value.noPlaces, false);
  const i1 = r.value.indicators.find((i) => i.code === "OC1");
  assert.equal(i1.rollup.rows[0].name, "White Nile");
  assert.equal(i1.rollup.rows[0].value, "110");
  const i2 = r.value.indicators.find((i) => i.code === "OC2");
  assert.equal(i2.isRate, true);
  assert.equal(i2.rollup.additive, false);
  assert.deepEqual(r.value.withoutLocation.map((i) => i.code), ["OC3"]);
});

test("an organisation with no places is told so, and typed locations stay unplaced", async () => {
  const r = await handler({ places: [], updates: [upd("i1", "p1", [entry("Rabak", "70")])] }).handle(ctx, "proj", 2);
  assert.equal(r.value.noPlaces, true);
  assert.equal(r.value.indicators[0].rollup.unplaced[0].reason, "NOT_IN_LIST");
  assert.deepEqual(r.value.levelsAvailable, []);
});

test("the periods come back in order with plain labels, for the map's time slider", async () => {
  const r = await handler({ places: PLACES, updates: [] }).handle(ctx, "proj", 1);
  assert.deepEqual(r.value.periods.map((p) => p.id), ["p1", "p2"]);
  assert.ok(r.value.periods.every((p) => p.label.length > 0 && !/undefined|NaN|T00/.test(p.label)), JSON.stringify(r.value.periods));
});

test("an archived or missing project is not found", async () => {
  const h = new GetProjectPlaceResultsHandler({ findById: async () => ok(null) }, {}, {}, {}, {});
  assert.equal((await h.handle(ctx, "x", 1)).error.code, "NOT_FOUND");
});

test("one period can be read on its own (the map's time slider); an unknown period is not found", async () => {
  const updates = [upd("i1", "p1", [entry("Rabak", "70")]), upd("i1", "p2", [entry("Rabak", "30")])];
  const h = handler({ places: PLACES, updates });
  const first = await h.handle(ctx, "proj", 2, { periodId: "p1" });
  assert.equal(first.value.indicators[0].rollup.rows[0].value, "70");
  const second = await h.handle(ctx, "proj", 2, { periodId: "p2" });
  assert.equal(second.value.indicators[0].rollup.rows[0].value, "30");
  const whole = await h.handle(ctx, "proj", 2);
  assert.equal(whole.value.indicators[0].rollup.rows[0].value, "100");
  assert.equal((await h.handle(ctx, "proj", 2, { periodId: "nope" })).error.code, "NOT_FOUND");
});
