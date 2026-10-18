import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, PlannedActivity } from "@donordesk/domain";
import { CreateRiskHandler, UpdateRiskHandler, CloseRiskHandler, ListRisksHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const FIELD = ctxFor("fo", "FIELD_OFFICER");
const OTHER = ctxFor("zz", "FIELD_OFFICER");
const VIEWER = ctxFor("v", "VIEWER");
const ok = (value) => ({ ok: true, value });
const clock = { now: () => new Date("2026-03-10T09:00:00Z") };

function world() {
  const store = new Map();
  const audit = [];
  const sent = [];
  let n = 0;
  const repo = {
    create: async (r) => (store.set(r.id, r), ok(r)), update: async (r) => (store.set(r.id, r), ok(r)),
    findById: async (id) => ok(store.get(id) ?? null), findByProject: async (p) => ok([...store.values()].filter((r) => r.projectId === p)),
  };
  const roster = { activeMembers: async () => ok([{ userId: "pm", role: "PROJECT_MANAGER" }, { userId: "fo", role: "FIELD_OFFICER" }, { userId: "me", role: "ME_OFFICER" }]) };
  const plan = PlannedActivity.create({ id: "pa1", tenantId: "tenant-a", projectId: "p", title: "Outreach", plannedStart: "2026-03-01", plannedEnd: "2026-03-05", createdById: "u" }).value;
  const plans = { findById: async (id) => ok(id === "pa1" ? plan : null) };
  const notifier = { send: async (x) => void sent.push(x) };
  const log = { record: async (e) => void audit.push(e) };
  return { store, audit, sent, repo, create: new CreateRiskHandler({ generate: () => `r${++n}` }, repo, roster, plans, notifier, log, clock), update: new UpdateRiskHandler(repo, roster, notifier, log, clock), close: new CloseRiskHandler(repo, log, clock), list: new ListRisksHandler(repo) };
}
const raise = (extra = {}) => ({ kind: "PROBLEM", title: "Road washed out", seriousness: "HIGH", action: "Rerouting trucks", ...extra });

test("raising: anyone but a viewer; the handler must be a member; the person chosen is told; audited", async () => {
  const w = world();
  assert.equal((await w.create.handle(VIEWER, "p", raise())).error.code, "FORBIDDEN");
  assert.equal((await w.create.handle(FIELD, "p", raise({ ownerId: "stranger" }))).error.details.field, "ownerId");
  assert.equal((await w.create.handle(FIELD, "p", raise({ plannedActivityId: "nope" }))).error.details.field, "plannedActivityId");
  assert.equal(w.store.size, 0, "nothing saved for a refusal");
  const out = await w.create.handle(FIELD, "p", raise({ ownerId: "pm", plannedActivityId: "pa1" }));
  assert.equal(out.ok, true);
  const s = w.store.get(out.value.id).snapshot();
  assert.deepEqual([s.raisedById, s.ownerId, s.reviewBy, s.plannedActivityId], ["fo", "pm", "2026-04-09", "pa1"]);
  assert.deepEqual([w.sent[0].recipientId, w.sent[0].title, w.sent[0].urgent], ["pm", "A serious problem is yours to handle", true]);
  assert.equal(w.audit[0].eventType, "risk.created");
  await w.create.handle(FIELD, "p", raise({ ownerId: "fo" }));
  assert.equal(w.sent.length, 1, "you are not told about what you gave yourself");
});

test("changing: the one handling it, the one who raised it, or a manager; not a stranger; the new handler is told", async () => {
  const w = world();
  const id = (await w.create.handle(FIELD, "p", raise({ ownerId: "me" }))).value.id;
  assert.equal((await w.update.handle(OTHER, id, { action: "x" })).error.code, "FORBIDDEN");
  assert.equal((await w.update.handle(FIELD, id, { action: "Boats instead" })).ok, true, "the one who raised it");
  assert.equal((await w.update.handle(ctxFor("me", "ME_OFFICER"), id, { seriousness: "MEDIUM" })).ok, true, "the one handling it");
  assert.equal(w.store.get(id).reviewBy, undefined, "less serious: no review scheduled");
  w.sent.length = 0;
  assert.equal((await w.update.handle(PM, id, { ownerId: "pm" })).ok, true);
  assert.equal(w.store.get(id).ownerId, "pm");
  assert.equal(w.sent.length, 0, "a manager who takes it is not told about themselves");
  assert.equal((await w.update.handle(PM, id, { ownerId: "fo" })).ok, true);
  assert.equal(w.sent[0].recipientId, "fo");
  assert.equal((await w.update.handle(PM, id, { ownerId: "stranger" })).error.details.field, "ownerId");
  assert.equal((await w.update.handle(PM, id, { ownerId: null })).ok, true);
  assert.equal(w.store.get(id).ownerId, undefined, "nobody handling it");
  const audits = w.audit.filter((a) => a.eventType === "risk.updated").length;
  await w.update.handle(PM, id, { action: "Boats instead" });
  assert.equal(w.audit.filter((a) => a.eventType === "risk.updated").length, audits, "no change, no audit event");
  assert.equal((await w.update.handle(PM, "nope", { action: "x" })).error.code, "NOT_FOUND");
});

test("closing: same people, with a note; a closed one cannot be closed or changed", async () => {
  const w = world();
  const id = (await w.create.handle(FIELD, "p", raise())).value.id;
  assert.equal((await w.close.handle(OTHER, id, {})).error.code, "FORBIDDEN");
  assert.equal((await w.close.handle(FIELD, id, { note: "Road repaired" })).ok, true);
  assert.equal(w.store.get(id).snapshot().closedNote, "Road repaired");
  assert.equal(w.audit.at(-1).eventType, "risk.closed");
  assert.equal((await w.close.handle(PM, id, {})).ok, false);
  assert.equal((await w.update.handle(PM, id, { action: "x" })).ok, false);
});

test("the list: open first, the most serious at the top, then a few closed; each says whether you may change it", async () => {
  const w = world();
  const low = (await w.create.handle(FIELD, "p", raise({ title: "Low one", seriousness: "LOW" }))).value.id;
  const high = (await w.create.handle(FIELD, "p", raise({ title: "High one", seriousness: "HIGH" }))).value.id;
  const done = (await w.create.handle(FIELD, "p", raise({ title: "Done one" }))).value.id;
  await w.close.handle(FIELD, done, { note: "ok" });
  const asField = (await w.list.handle(FIELD, "p")).value;
  assert.deepEqual(asField.map((r) => [r.title, r.status, r.canChange]), [["High one", "OPEN", true], ["Low one", "OPEN", true], ["Done one", "CLOSED", false]]);
  const asOther = (await w.list.handle(OTHER, "p")).value;
  assert.deepEqual(asOther.map((r) => r.canChange), [false, false, false]);
  assert.equal((await w.list.handle(PM, "p")).value[0].canChange, true, "a manager");
  assert.deepEqual((await w.list.handle(PM, "elsewhere")).value, []);
  assert.ok(low && high);
});
