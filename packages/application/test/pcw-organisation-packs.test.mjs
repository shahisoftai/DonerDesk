import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { ListOrganisationPacksHandler, SaveOrganisationPackHandler, RemoveOrganisationPackHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const as = (role) => ({ tenant: { tenantId, userId: "u1", role }, requestId: "r" });

function fakes() {
  const rows = new Map();
  const events = [];
  const repo = {
    list: async () => ({ ok: true, value: [...rows].map(([sectorKey, pack]) => ({ sectorKey, pack, updatedAt: new Date(0), updatedById: "u1" })) }),
    save: async (_t, key, pack) => { rows.set(key, pack); return { ok: true, value: undefined }; },
    remove: async (_t, key) => ({ ok: true, value: rows.delete(key) }),
  };
  const audit = { record: async (e) => { events.push(e.eventType); } };
  return { rows, events, repo, audit };
}
const good = { sector: "WASH", label: "Our WASH answers", cadence: "QUARTERLY", reportRules: [{ reportType: "QUARTERLY", dueDaysAfterEnd: 20 }], risks: [{ title: "Floods", seriousness: "HIGH" }] };

test("only an administrator can read, save or remove packs", async () => {
  const f = fakes();
  for (const role of ["PROJECT_MANAGER", "VIEWER", "ME_OFFICER"]) {
    assert.equal((await new ListOrganisationPacksHandler(f.repo).handle(as(role))).ok, false);
    assert.equal((await new SaveOrganisationPackHandler(f.repo, f.audit).handle(as(role), good)).ok, false);
    assert.equal((await new RemoveOrganisationPackHandler(f.repo, f.audit).handle(as(role), "WASH")).ok, false);
  }
  assert.equal(f.rows.size, 0);
});

test("a saved pack is stored under its sector, audited, listed beside the built-in ones, and a bad pack stores nothing", async () => {
  const f = fakes();
  const save = new SaveOrganisationPackHandler(f.repo, f.audit);
  const bad = await save.handle(as("ADMIN"), { ...good, risks: [{ title: "x", seriousness: "SEVERE" }] });
  assert.equal(bad.ok, false);
  assert.equal(f.rows.size, 0);
  assert.ok((await save.handle(as("ADMIN"), good)).ok);
  assert.deepEqual([...f.rows.keys()], ["WASH"]);
  assert.deepEqual(f.events, ["setup.pack_saved"]);
  const listed = await new ListOrganisationPacksHandler(f.repo).handle(as("ADMIN"));
  assert.equal(listed.value.own.length, 1);
  assert.ok(listed.value.builtIn.length >= 4);
});

test("removing a pack brings back the built-in one, and removing one that is not there says so", async () => {
  const f = fakes();
  await new SaveOrganisationPackHandler(f.repo, f.audit).handle(as("ADMIN"), good);
  const remove = new RemoveOrganisationPackHandler(f.repo, f.audit);
  assert.ok((await remove.handle(as("ADMIN"), "WASH")).ok);
  assert.equal((await remove.handle(as("ADMIN"), "WASH")).ok, false);
  assert.deepEqual(f.events, ["setup.pack_saved", "setup.pack_removed"]);
});
