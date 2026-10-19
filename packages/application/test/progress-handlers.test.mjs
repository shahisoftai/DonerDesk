import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, PlannedActivity } from "@donordesk/domain";
import { SaveProgressHandler, PrepareProgressHandler, RemoveProgressHandler, GetProgressHandler, PlanAccess } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const LEAD = ctxFor("fo", "FIELD_OFFICER");
const OTHER = ctxFor("me", "VIEWER");
const ok = (value) => ({ ok: true, value });

function world() {
  const items = new Map([["a1", PlannedActivity.create({ id: "a1", tenantId: "tenant-a", projectId: "p", title: "Screening", plannedStart: "2026-10-01", plannedEnd: "2026-11-30", people: { ownerUserId: "fo", supportUserIds: [] }, createdById: "pm" }).value]]);
  const rows = new Map();
  let n = 0;
  const ids = { generate: () => `e${++n}` };
  const clock = { now: () => new Date("2026-10-19T09:00:00Z") };
  const audit = [];
  const auditLogger = { record: async (e) => void audit.push(e) };
  const access = new PlanAccess({ findById: async (id) => ok(items.get(id) ?? null), findByProject: async () => ok([...items.values()]) });
  const indicators = { findByProject: async () => ok([{ id: "i1", code: "1.1", targetBreakdowns: [{ dimension: "AGE_GROUP", category: "Under 5" }, { dimension: "SEX", category: "Women" }] }]) };
  const links = { findIndicatorIds: async () => ok(["i1"]) };
  const progress = {
    findByItem: async (id) => ok([...rows.values()].filter((r) => r.plannedActivityId === id)),
    save: async (e, absorbIds) => {
      rows.set(e.id, e);
      for (const id of absorbIds) rows.set(id, { ...rows.get(id), absorbedById: e.id });
      return ok(undefined);
    },
    remove: async (id) => {
      if (!rows.has(id)) return ok(false);
      rows.delete(id);
      for (const r of rows.values()) if (r.absorbedById === id) r.absorbedById = null;
      return ok(true);
    },
  };
  const save = new SaveProgressHandler(access, progress, links, indicators, ids, auditLogger, clock);
  return {
    rows, audit, items,
    save,
    prepare: new PrepareProgressHandler(access, progress, links, indicators),
    remove: new RemoveProgressHandler(access, progress, auditLogger),
    get: new GetProgressHandler(access, progress, links, indicators),
  };
}

const daily = (date, total, extra = {}) => ({ kind: "DAILY", key: date, values: { total, breakdowns: { "AGE_GROUP|under 5": "", "SEX|women": "" }, sessions: "", unique: "" }, narrative: {}, ...extra });
const monthly = (month, total, breakdowns = {}) => ({ kind: "MONTHLY", key: month, values: { total, breakdowns: { "AGE_GROUP|under 5": "", "SEX|women": "", ...breakdowns }, sessions: "", unique: "" }, narrative: {} });

test("a daily figure is saved; a blank stays blank in storage, never 0", async () => {
  const w = world();
  const res = await w.save.handle(LEAD, "a1", daily("2026-10-05", "12"));
  assert.equal(res.ok, true);
  const saved = [...w.rows.values()][0];
  assert.equal(saved.values.total, 12);
  assert.equal(saved.values.breakdowns["SEX|women"], null, "blank breakdown is null");
  assert.equal(saved.values.sessions, null);
});

test("a day outside the activity, a bad number, and an all-blank entry are refused", async () => {
  const w = world();
  assert.equal((await w.save.handle(LEAD, "a1", daily("2026-12-01", "3"))).ok, false);
  assert.equal((await w.save.handle(LEAD, "a1", daily("2026-10-05", "3x"))).ok, false);
  assert.equal((await w.save.handle(LEAD, "a1", daily("2026-10-05", ""))).ok, false);
  assert.equal(w.rows.size, 0);
});

test("a day can be logged once; logging it again is refused with the way to change it", async () => {
  const w = world();
  await w.save.handle(LEAD, "a1", daily("2026-10-05", "12"));
  const again = await w.save.handle(LEAD, "a1", daily("2026-10-05", "9"));
  assert.equal(again.ok, false);
  assert.match(again.error.message, /already logged/);
  const id = [...w.rows.values()][0].id;
  const changed = await w.save.handle(LEAD, "a1", { ...daily("2026-10-05", "9"), replaceId: id });
  assert.equal(changed.ok, true);
  assert.equal(w.rows.get(id).values.total, 9);
  assert.equal(w.rows.size, 1);
});

test("a monthly report prefills from the daily entries in its month, and absorbs them so they are not counted twice", async () => {
  const w = world();
  await w.save.handle(LEAD, "a1", daily("2026-10-05", "12"));
  await w.save.handle(LEAD, "a1", daily("2026-10-06", "8"));
  await w.save.handle(LEAD, "a1", daily("2026-11-02", "5"));
  const pre = await w.prepare.handle(LEAD, "a1", "MONTHLY", "2026-10");
  assert.equal(pre.value.sources, 2);
  assert.equal(pre.value.values.total, 20, "prefilled from the two October days");
  assert.equal(pre.value.values.breakdowns["SEX|women"], null, "nothing recorded stays blank");

  const res = await w.save.handle(LEAD, "a1", monthly("2026-10", "20"));
  assert.equal(res.value.absorbed, 2);
  const absorbed = [...w.rows.values()].filter((r) => r.kind === "DAILY" && r.from.startsWith("2026-10"));
  assert.ok(absorbed.every((r) => r.absorbedById === res.value.id));
  const end = await w.prepare.handle(LEAD, "a1", "END", "");
  assert.equal(end.value.values.total, 25, "activity end counts October once (20) plus November's day (5)");
});

test("a day inside a saved monthly report cannot be logged or changed on its own", async () => {
  const w = world();
  await w.save.handle(LEAD, "a1", daily("2026-10-05", "12"));
  await w.save.handle(LEAD, "a1", monthly("2026-10", "12"));
  const clash = await w.save.handle(LEAD, "a1", daily("2026-10-07", "3"));
  assert.equal(clash.ok, false, "a day inside a monthly report is refused");
  const dailyId = [...w.rows.values()].find((r) => r.kind === "DAILY").id;
  const editAbsorbed = await w.save.handle(LEAD, "a1", daily("2026-10-05", "99"));
  assert.equal(editAbsorbed.ok, false);
  assert.match(editAbsorbed.error.message, /monthly report/);
  assert.equal(w.rows.get(dailyId).values.total, 12);
});

test("removing a monthly report releases the daily entries it had absorbed", async () => {
  const w = world();
  await w.save.handle(LEAD, "a1", daily("2026-10-05", "12"));
  const m = await w.save.handle(LEAD, "a1", monthly("2026-10", "12"));
  assert.equal((await w.remove.handle(LEAD, "a1", m.value.id)).ok, true);
  const day = [...w.rows.values()].find((r) => r.kind === "DAILY");
  assert.equal(day.absorbedById, null);
  assert.equal((await w.prepare.handle(LEAD, "a1", "END", "")).value.values.total, 12);
});

test("a weekly entry that crosses a month end is refused; one inside a month is saved", async () => {
  const w = world();
  assert.equal((await w.save.handle(LEAD, "a1", { kind: "WEEKLY", key: "2026-10-28", values: { total: "4", breakdowns: {}, sessions: "", unique: "" }, narrative: {} })).ok, false);
  assert.equal((await w.save.handle(LEAD, "a1", { kind: "WEEKLY", key: "2026-10-12", values: { total: "4", breakdowns: {}, sessions: "", unique: "" }, narrative: {} })).ok, true);
});

test("the log is readable by anyone who can see the plan and changes by the lead only", async () => {
  const w = world();
  assert.equal((await w.save.handle(OTHER, "a1", daily("2026-10-05", "1"))).ok, false);
  const read = await w.get.handle(OTHER, "a1");
  assert.equal(read.ok, true);
  assert.equal(read.value.fields.length, 2);
});

import { MarkPlanDoneHandler, PlanRecorder } from "../dist/index.js";

test("one step Done marks the activity done on the day it finished and records people reached once", async () => {
  const w = world();
  const audit = [];
  const recorder = new PlanRecorder({ generate: () => "rev" }, { append: async () => ok(undefined) }, { record: async (e) => void audit.push(e) }, { now: () => new Date("2026-10-19T09:00:00Z") });
  const access = new PlanAccess({ findById: async (id) => ok(w.items?.get(id) ?? null) });
  const { PlannedActivity: PA } = await import("@donordesk/domain");
  const act = PA.create({ id: "a2", tenantId: "tenant-a", projectId: "p", title: "Distribution", plannedStart: "2026-10-01", plannedEnd: "2026-10-30", people: { ownerUserId: "fo", supportUserIds: [] }, createdById: "pm" }).value;
  const store = w.items;
  store.set("a2", act);
  const repo = { update: async (i) => (store.set(i.id, i), ok(i)), findById: async (id) => ok(store.get(id) ?? null) };
  const access2 = new PlanAccess(repo);
  const handler = new MarkPlanDoneHandler(access2, repo, recorder, w.save, { findByItem: async () => ok([]) }, { now: () => new Date("2026-10-19T09:00:00Z") });
  const res = await handler.handle(LEAD, "a2", { finishedOn: "2026-10-12", people: "40", notes: "Done in two villages" });
  assert.equal(res.ok, true, res.error?.message);
  assert.equal(store.get("a2").status, "DONE");
  assert.equal(store.get("a2").completedOn, "2026-10-12");
  const bad = await handler.handle(LEAD, "a2", { finishedOn: "2026-02-30", people: "", notes: "" });
  assert.equal(bad.ok, false);
});
