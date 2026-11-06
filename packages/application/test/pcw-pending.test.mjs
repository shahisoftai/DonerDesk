// People named before they have an account (Phase 38.9c): remembered at launch, set up when they join.
import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, DomainError } from "@donordesk/domain";
import { ResponsibilitiesStep, IndicatorOwnerApplier, PendingMemberResolver, applyResponsibilities } from "../dist/index.js";
import { completeDraftForTest } from "./support/pcw-complete-draft.mjs";

const tenantId = TenantId.create("tenant-a");
const as = (userId, role = "ADMIN") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const ok = (value) => ({ ok: true, value });
const fail = (message) => ({ ok: false, error: DomainError.validation(message) });

function world() {
  const assigned = [];
  const owned = [];
  const stored = [];
  const audit = { events: [], async record(e) { this.events.push(e); } };
  const members = { async assign(_c, projectId, userId, role) { assigned.push([projectId, userId, role]); return ok(undefined); } };
  const owners = { async idsByCode() { return ok(new Map([["I1", "ind-1"]])); }, async setOwner(_c, indicatorId, userId) { owned.push([indicatorId, userId]); return ok(undefined); } };
  const pending = {
    stored,
    async create(m) { stored.push(m); return ok(undefined); },
    async find(t, p, e) { return ok(stored.find((m) => m.tenantId === t && m.projectId === p && m.email === e) ?? null); },
    async listByEmail(t, e) { return ok(stored.filter((m) => m.tenantId === t && m.email === e)); },
    async delete(id) { const i = stored.findIndex((m) => m.id === id); if (i >= 0) stored.splice(i, 1); return ok(undefined); },
  };
  let n = 0;
  const appliers = [new IndicatorOwnerApplier(owners)];
  return { assigned, owned, pending, audit, members, owners, appliers, newId: () => `pm-${++n}`, now: () => new Date("2026-11-02T08:00:00Z") };
}
const people = (accounts) => ({ async idsByEmail(_c, emails) { return ok(new Map(emails.filter((e) => e in accounts).map((e) => [e, accounts[e]]))); } });

function draftWithOwner() {
  const d = completeDraftForTest();
  d.extras.team = [
    { key: "me", name: "Mia", email: "Mia@x.org", role: "ME_OFFICER", external: false, invite: "NOW" },
    { key: "pm", name: "Pat", email: "pat@x.org", role: "PROJECT_MANAGER", external: false, invite: "LATER" },
    { key: "fo", name: "Fay", email: null, role: "FIELD_OFFICER", external: false, invite: "LATER" },
  ];
  d.extras.indicatorSetup = { I1: { ownerKey: "me", method: "FORM", directionConfirmed: true } };
  return d;
}

test("someone with an account joins the project now and owns their indicators now", async () => {
  const w = world();
  const step = new ResponsibilitiesStep(people({ "mia@x.org": "u-mia" }), w.members, w.pending, w.appliers, w.now, w.newId);
  const out = await step.run(as("u1"), "p1", draftWithOwner());
  assert.deepEqual(w.assigned, [["p1", "u-mia", "ME_OFFICER"]]);
  assert.deepEqual(w.owned, [["ind-1", "u-mia"]]);
  assert.equal(out.value.done, 2, "Mia now, Pat remembered");
  assert.deepEqual(w.pending.stored.map((m) => [m.email, m.projectId, m.role, m.createdById]), [["pat@x.org", "p1", "PROJECT_MANAGER", "u1"]]);
});

test("someone without an account is remembered with what they will own, once, however often it runs", async () => {
  const w = world();
  const d = draftWithOwner();
  d.extras.indicatorSetup.I1.ownerKey = "pm";
  const step = new ResponsibilitiesStep(people({}), w.members, w.pending, w.appliers, w.now, w.newId);
  await step.run(as("u1"), "p1", d);
  await step.run(as("u1"), "p1", d);
  assert.equal(w.pending.stored.length, 2, "Mia and Pat once each");
  assert.equal(w.pending.stored.find((m) => m.email === "pat@x.org").responsibilitiesJson, JSON.stringify([{ kind: "INDICATOR_OWNER", indicatorCode: "I1" }]));
  assert.deepEqual(w.owned, []);
});

test("a person with no email who was to own something is named in the report, not lost silently", async () => {
  const w = world();
  const d = draftWithOwner();
  d.extras.indicatorSetup.I1.ownerKey = "fo";
  const out = await new ResponsibilitiesStep(people({}), w.members, w.pending, w.appliers, w.now, w.newId).run(as("u1"), "p1", d);
  assert.match(out.value.notes[0], /Fay has no email address, so owns indicator I1 and leads “Drill wells” could not be kept/);
  assert.equal(w.pending.stored.some((m) => m.name === "Fay"), false);
});

test("a refusal when adding or when setting an owner is a note and the rest carries on", async () => {
  const w = world();
  const members = { async assign(_c, p, u) { return u === "u-mia" ? fail("Already has a different role.") : ok(undefined); } };
  const owners = { async idsByCode() { return ok(new Map([["I1", "ind-1"]])); }, async setOwner() { return fail("Only a member can lead."); } };
  const d = draftWithOwner();
  const step = new ResponsibilitiesStep(people({ "mia@x.org": "u-mia", "pat@x.org": "u-pat" }), members, w.pending, [new IndicatorOwnerApplier(owners)], w.now, w.newId);
  const out = await step.run(as("u1"), "p1", d);
  const notFay = (notes) => notes.filter((n) => !n.startsWith("Fay "));
  assert.deepEqual(notFay(out.value.notes), ["Mia could not be added to the project: Already has a different role."]);
  d.extras.indicatorSetup.I1.ownerKey = "pm";
  const second = await step.run(as("u1"), "p1", d);
  assert.deepEqual(notFay(second.value.notes), ["Mia could not be added to the project: Already has a different role.", "Pat owns indicator I1: Only a member can lead."]);
});

test("an owner whose indicator is not in the project is a note, not a crash", async () => {
  const w = world();
  const none = { async idsByCode() { return ok(new Map()); }, async setOwner() { return ok(undefined); } };
  const out = await applyResponsibilities([new IndicatorOwnerApplier(none)], as("u1"), "p1", "u2", [{ kind: "INDICATOR_OWNER", indicatorCode: "I9" }]);
  assert.equal(out.done, 0);
  assert.equal(out.failed.length, 1);
  assert.ok(out.failed[0].reason.length > 5);
});

// ---------- when they join ----------

function resolver(w, actingAs = as("u1")) {
  return new PendingMemberResolver(w.pending, w.members, { async asUser() { return actingAs; } }, w.appliers, w.audit);
}
const record = (extra = {}) => ({ id: "r1", tenantId: "tenant-a", projectId: "p1", email: "pat@x.org", name: "Pat", role: "PROJECT_MANAGER", createdById: "u1", responsibilitiesJson: JSON.stringify([{ kind: "INDICATOR_OWNER", indicatorCode: "I1" }]), createdAt: new Date(), ...extra });

test("when the person joins they become a member and own what was set for them, and the record is removed", async () => {
  const w = world();
  w.pending.stored.push(record());
  const r = await resolver(w).resolve({ tenantId: "tenant-a", userId: "u-pat", email: "Pat@X.org" });
  assert.deepEqual(w.assigned, [["p1", "u-pat", "PROJECT_MANAGER"]]);
  assert.deepEqual(w.owned, [["ind-1", "u-pat"]]);
  assert.deepEqual([r.resolved, r.notes], [1, []]);
  assert.deepEqual(w.pending.stored, []);
  assert.equal(w.audit.events[0].eventType, "setup.pending_member.resolved");
});

test("it acts with the launcher's authority, and does nothing for an email nobody named", async () => {
  const w = world();
  w.pending.stored.push(record());
  const seen = [];
  const acting = { async asUser(t, u) { seen.push([t, u]); return as(u); } };
  await new PendingMemberResolver(w.pending, w.members, acting, w.appliers, w.audit).resolve({ tenantId: "tenant-a", userId: "u-x", email: "someone@else.org" });
  assert.deepEqual(seen, []);
  await new PendingMemberResolver(w.pending, w.members, acting, w.appliers, w.audit).resolve({ tenantId: "tenant-a", userId: "u-pat", email: "pat@x.org" });
  assert.deepEqual(seen, [["tenant-a", "u1"]]);
});

test("what cannot be done is returned as sentences and the record is kept; the person is never blocked", async () => {
  const w = world();
  w.pending.stored.push(record());
  const failing = { async idsByCode() { return ok(new Map([["I1", "ind-1"]])); }, async setOwner() { return fail("Only a member can lead."); } };
  const r = await new PendingMemberResolver(w.pending, w.members, { async asUser() { return as("u1"); } }, [new IndicatorOwnerApplier(failing)], w.audit).resolve({ tenantId: "tenant-a", userId: "u-pat", email: "pat@x.org" });
  assert.deepEqual([r.resolved, r.notes], [0, ["Pat owns indicator I1: Only a member can lead."]]);
  assert.equal(w.pending.stored.length, 1);
  const gone = await new PendingMemberResolver(w.pending, w.members, { async asUser() { return null; } }, w.appliers, w.audit).resolve({ tenantId: "tenant-a", userId: "u-pat", email: "pat@x.org" });
  assert.match(gone.notes[0], /can no longer act/);
  assert.equal(w.pending.stored.length, 1);
});

test("a damaged stored record gives the person their place on the project and nothing else", async () => {
  const w = world();
  w.pending.stored.push(record({ responsibilitiesJson: "not json" }));
  const r = await resolver(w).resolve({ tenantId: "tenant-a", userId: "u-pat", email: "pat@x.org" });
  assert.deepEqual(w.assigned, [["p1", "u-pat", "PROJECT_MANAGER"]]);
  assert.deepEqual(w.owned, []);
  assert.equal(r.resolved, 1);
});
