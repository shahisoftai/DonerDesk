import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, IndicatorUpdate, ReportingPeriod } from "@donordesk/domain";
import { CreateIndicatorUpdateHandler, BulkUpsertIndicatorUpdatesHandler, SubmitPeriodIndicatorUpdatesHandler, SetPeriodEntryWindowHandler, checkEntryWindow } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const as = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const OFFICER = as("o", "FIELD_OFFICER");
const REVIEWER = as("m", "ME_OFFICER");
const ok = (value) => ({ ok: true, value });
const now = () => new Date("2026-12-20T10:00:00Z");

const period = (window = {}) => ReportingPeriod.rehydrate({ id: "p1", tenantId: "tenant-a", projectId: "proj", createdAt: new Date(), props: {
  reportType: "MONTHLY", duration: { start: new Date("2026-11-01"), end: new Date("2026-11-30"), overlaps: () => false }, deadline: new Date("2026-12-09"),
  status: { toString: () => "NOT_STARTED", value: "NOT_STARTED" }, readinessScore: 0, reportingProfileSnapshotJson: "{}", templateSnapshotJson: "{}", scopeJson: "{}", ...window } });

test("the guard: reviewers are never held to the window; others are refused outside it with the dates", () => {
  const closed = period({ entryOpensOn: "2026-12-01", entryClosesOn: "2026-12-10" });
  assert.equal(checkEntryWindow(REVIEWER, closed, now()).ok, true);
  const refused = checkEntryWindow(OFFICER, closed, now());
  assert.equal(refused.error.code, "CONFLICT");
  assert.match(refused.error.message, /closed on 10 Dec 2026/);
  assert.equal(checkEntryWindow(OFFICER, closed, new Date("2026-12-05T00:00:00Z")).ok, true);
  assert.equal(checkEntryWindow(OFFICER, period(), now()).ok, true);
});

test("single, bulk and submit all refuse an officer outside the window and let a reviewer through", async () => {
  const closed = period({ entryClosesOn: "2026-12-10" });
  const periods = { findById: async () => ok(closed) };
  const single = new CreateIndicatorUpdateHandler({ generate: () => "i" }, {}, { record: async () => {} }, {}, periods, undefined, undefined, now);
  assert.match((await single.handle(OFFICER, { reportingPeriodId: "p1", indicatorId: "a", periodAchievement: "1", cumulativeAchievement: "1" })).error.message, /closed on 10 Dec 2026/);
  const bulk = new BulkUpsertIndicatorUpdatesHandler({ generate: () => "i" }, {}, { findByProject: async () => ok([]) }, periods, { record: async () => {} }, undefined, undefined, now);
  assert.match((await bulk.handle(OFFICER, { reportingPeriodId: "p1", updates: [] })).error.message, /closed on 10 Dec 2026/);
  assert.equal((await bulk.handle(REVIEWER, { reportingPeriodId: "p1", updates: [] })).ok, true);
  const submit = new SubmitPeriodIndicatorUpdatesHandler({}, {}, periods, {}, { record: async () => {} }, undefined, now);
  assert.match((await submit.handle(OFFICER, "p1")).error.message, /closed on 10 Dec 2026/);
});

test("setting the window validates, audits, clears with empty days, and refuses a cancelled period", async () => {
  const p = period();
  const audit = [];
  const h = new SetPeriodEntryWindowHandler({ findById: async () => ok(p), update: async (x) => ok(x) }, { record: async (e) => void audit.push(e) }, now);
  assert.match((await h.handle(OFFICER, "p1", { opensOn: "2026-12-10", closesOn: "2026-12-01" })).error.message, /cannot close before it opens/);
  const set = await h.handle(OFFICER, "p1", { opensOn: "2026-12-01", closesOn: "2026-12-31" });
  assert.deepEqual([p.entryOpensOn, p.entryClosesOn], ["2026-12-01", "2026-12-31"]);
  assert.equal(set.value.description, "Entry is open until 31 Dec 2026.");
  assert.equal(audit.at(-1).eventType, "period.entry_window_set");
  await h.handle(OFFICER, "p1", { opensOn: "", closesOn: null });
  assert.deepEqual([p.entryOpensOn, p.entryClosesOn], [undefined, undefined]);
  p.cancel("x", new Date());
  assert.equal((await h.handle(OFFICER, "p1", {})).error.code, "CONFLICT");
  assert.equal((await new SetPeriodEntryWindowHandler({ findById: async () => ok(null) }, {}).handle(OFFICER, "zz", {})).error.code, "NOT_FOUND");
});
