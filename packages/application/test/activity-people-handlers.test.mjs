import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, PlannedActivity } from "@donordesk/domain";
import { GetActivityPeopleHandler, ChangeActivityPeopleHandler, PlanAccess } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const LEAD = ctxFor("fo", "FIELD_OFFICER");
const STRANGER = ctxFor("me", "VIEWER");
const ok = (value) => ({ ok: true, value });

function world() {
  const linked = new Set();
  const audit = [];
  const people = [
    { id: "b1", caseCode: "NG-0001", sex: "FEMALE", ageGroup: "UNDER_5", projectId: "p" },
    { id: "b2", caseCode: "NG-0002", sex: "MALE", ageGroup: "AGE_18_59", projectId: "p" },
    { id: "b3", caseCode: "NG-0003", sex: "FEMALE", ageGroup: "AGE_18_59", projectId: "p" },
  ];
  const items = new Map([["a1", PlannedActivity.create({ id: "a1", tenantId: "tenant-a", projectId: "p", title: "Clinic", plannedStart: "2026-10-10", plannedEnd: "2026-10-12", people: { ownerUserId: "fo", supportUserIds: [] }, createdById: "pm" }).value]]);
  const access = new PlanAccess({ findById: async (id) => ok(items.get(id) ?? null) });
  const links = {
    findBeneficiaryIds: async () => ok([...linked]),
    add: async ({ beneficiaryIds }) => { let n = 0; for (const id of beneficiaryIds) if (!linked.has(id)) { linked.add(id); n++; } return ok(n); },
    remove: async (_i, ids) => { let n = 0; for (const id of ids) if (linked.delete(id)) n++; return ok(n); },
  };
  const beneficiaries = { findByProject: async () => ok(people) };
  const auditLogger = { record: async (e) => void audit.push(e) };
  const clock = { now: () => new Date("2026-10-19T09:00:00Z") };
  return {
    linked, audit,
    get: new GetActivityPeopleHandler(access, links, beneficiaries),
    change: new ChangeActivityPeopleHandler(access, links, beneficiaries, auditLogger, clock),
  };
}

test("the lead adds people by pasted case codes; an unknown code is reported and nothing is guessed", async () => {
  const w = world();
  const res = await w.change.handle(LEAD, "a1", { addCaseCodes: "NG-0001, NG-0002\nNG-9999", removeIds: [] });
  assert.deepEqual(res.value, { added: 2, removed: 0, unknown: ["NG-9999"] });
  const view = (await w.get.handle(LEAD, "a1")).value;
  assert.equal(view.counts.total, 2);
  assert.deepEqual(view.counts.bySex, { FEMALE: 1, MALE: 1 });
});

test("a person added twice still counts once", async () => {
  const w = world();
  await w.change.handle(LEAD, "a1", { addCaseCodes: "NG-0001", removeIds: [] });
  const again = await w.change.handle(LEAD, "a1", { addCaseCodes: "NG-0001 NG-0001", removeIds: [] });
  assert.equal(again.value.added, 0);
  assert.equal((await w.get.handle(LEAD, "a1")).value.counts.total, 1);
  assert.equal(w.audit.length, 1, "only a real change is audited");
});

test("codes that match no one are refused; removing works; a stranger cannot change it", async () => {
  const w = world();
  const none = await w.change.handle(LEAD, "a1", { addCaseCodes: "ZZ-1", removeIds: [] });
  assert.equal(none.ok, false);
  assert.match(none.error.message, /ZZ-1/);
  await w.change.handle(LEAD, "a1", { addCaseCodes: "NG-0001", removeIds: [] });
  assert.equal((await w.change.handle(STRANGER, "a1", { addCaseCodes: "NG-0002", removeIds: [] })).ok, false);
  assert.deepEqual((await w.change.handle(LEAD, "a1", { addCaseCodes: "", removeIds: ["b1", "not-in-project"] })).value, { added: 0, removed: 1, unknown: [] });
  assert.equal((await w.get.handle(STRANGER, "a1")).ok, true, "anyone who can see the plan can read it");
});
