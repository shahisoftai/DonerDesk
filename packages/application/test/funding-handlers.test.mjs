import assert from "node:assert/strict";
import test from "node:test";
import { ListFundingHandler, SaveProgrammeHandler, SaveGrantHandler, PlaceProjectHandler } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const ctx = (role = "ADMIN") => ({ tenant: { tenantId, userId: "u1", role }, requestId: "r" });
const ok = (value) => ({ ok: true, value });

function world() {
  const s = { programmes: [], grants: [], placed: new Map(), audits: [] };
  let n = 0;
  const funding = {
    listProgrammes: async () => ok(s.programmes),
    findProgramme: async (id) => ok(s.programmes.find((p) => p.id === id) ?? null),
    createProgramme: async (r) => { s.programmes.push(r); return ok(r); },
    updateProgramme: async (id, _t, c) => { Object.assign(s.programmes.find((p) => p.id === id), c); return ok(undefined); },
    listGrants: async () => ok(s.grants),
    findGrant: async (id) => ok(s.grants.find((g) => g.id === id) ?? null),
    createGrant: async (r) => { s.grants.push(r); return ok(r); },
    updateGrant: async (id, _t, c) => { Object.assign(s.grants.find((g) => g.id === id), c); return ok(undefined); },
    projectPlacements: async () => ok(s.placed),
    placeProject: async (id, _t, p) => { s.placed.set(id, p); return ok(undefined); },
  };
  const ids = { generate: () => `id${++n}` };
  const audit = { record: async (e) => { s.audits.push(e.eventType); } };
  const projects = { findById: async (id) => ok(id === "p1" || id === "p2" ? { id } : null) };
  const visible = { for: async () => ok([
    { id: "p1", title: "Water", status: "ACTIVE", budget: { amount: 1000, currency: "USD" } },
    { id: "p2", title: "Health", status: "ACTIVE" },
  ]) };
  return { s, save: new SaveProgrammeHandler(funding, ids, audit), grant: new SaveGrantHandler(funding, ids, audit), place: new PlaceProjectHandler(funding, projects, audit), list: new ListFundingHandler(funding, visible) };
}

test("H-2: only someone who may create projects can change the hierarchy", async () => {
  const w = world();
  await assert.rejects(w.save.handle(ctx("VIEWER"), { name: "Horn" }));
  await assert.rejects(w.grant.handle(ctx("VIEWER"), { title: "t", donorName: "d" }));
  await assert.rejects(w.place.handle(ctx("VIEWER"), "p1", { grantId: "g" }));
});

test("H-2: programmes are unique by name; a bad grant is refused in plain words", async () => {
  const w = world();
  assert.equal((await w.save.handle(ctx(), { name: "Horn of Africa" })).ok, true);
  const dup = await w.save.handle(ctx(), { name: "horn of africa" });
  assert.equal(dup.ok, false);
  assert.equal(dup.error.code, "CONFLICT");
  const bad = await w.grant.handle(ctx(), { title: "t", donorName: "d", amount: "-5", currency: "USD" });
  assert.equal(bad.ok, false);
  assert.match(bad.error.message, /positive/);
  assert.equal((await w.grant.handle(ctx(), { title: "t", donorName: "d", programmeId: "missing" })).error.code, "NOT_FOUND");
});

test("H-2: a project placed under a grant brings the grant's programme; a mismatch is refused; null takes it out", async () => {
  const w = world();
  const prog = (await w.save.handle(ctx(), { name: "Horn" })).value.id;
  const other = (await w.save.handle(ctx(), { name: "Sahel" })).value.id;
  const grant = (await w.grant.handle(ctx(), { title: "WASH", donorName: "USAID", programmeId: prog, amount: "5000", currency: "USD" })).value.id;
  assert.deepEqual((await w.place.handle(ctx(), "p1", { grantId: grant })).value, { programmeId: prog, grantId: grant });
  assert.equal((await w.place.handle(ctx(), "p2", { grantId: grant, programmeId: other })).ok, false);
  assert.equal((await w.place.handle(ctx(), "nope", { grantId: grant })).error.code, "NOT_FOUND");
  assert.deepEqual((await w.place.handle(ctx(), "p1", { programmeId: null, grantId: null })).value, { programmeId: null, grantId: null });
  assert.ok(w.s.audits.includes("project.funding.placed"));
});

test("H-2: the funding view totals each programme over the projects a person may see, and lists what is unplaced", async () => {
  const w = world();
  const prog = (await w.save.handle(ctx(), { name: "Horn" })).value.id;
  const grant = (await w.grant.handle(ctx(), { title: "WASH", donorName: "USAID", programmeId: prog, amount: "5000", currency: "USD" })).value.id;
  await w.grant.handle(ctx(), { title: "Loose", donorName: "EU" });
  await w.place.handle(ctx(), "p1", { grantId: grant });
  const view = (await w.list.handle(ctx("VIEWER"))).value;
  assert.equal(view.programmes.length, 1);
  assert.deepEqual(view.programmes[0].totals, { projectCount: 1, activeProjectCount: 1, budgetByCurrency: { USD: 1000 }, awardedByCurrency: { USD: 5000 } });
  assert.equal(view.looseGrants.length, 1);
  assert.deepEqual(view.unplacedProjects.map((p) => p.id), ["p2"]);
});
