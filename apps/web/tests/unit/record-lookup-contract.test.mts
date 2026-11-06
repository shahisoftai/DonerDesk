import test from "node:test";
import assert from "node:assert/strict";
import type { OfflinePack } from "../../src/features/offline/domain/offline-pack.ts";
import type { RecordLookup } from "../../src/features/record/ports/record-lookup.ts";
import { createPackLookup } from "../../src/features/record/adapters/pack-lookup.ts";
import { createNetworkLookup } from "../../src/features/record/adapters/network-lookup.ts";

const v2: OfflinePack = {
  version: 2, userId: "u1", userName: "Amina", projectId: "p-b", projectName: "Borno WASH", generatedAt: 1,
  forms: [{ id: "f1", name: "Visit", fields: [] }],
  places: [{ id: "pl1", name: "Kondo", path: "Kondo › Borno › Nigeria" }],
  indicators: [{ id: "i1", code: "A1", name: "People", type: "NUMBER", disaggregationRequired: false, unit: "people" }],
  periods: [{ id: "per1", reportType: "MONTHLY", startDate: "2026-11-01", endDate: "2026-11-30", status: "DRAFT" }],
  plan: [{ id: "a1", title: "Hygiene", plannedStart: "2026-11-06", plannedEnd: "2026-11-06", status: "PLANNED" }],
};
const v1: OfflinePack = { version: 1, userId: "u1", userName: "Amina", projectId: "p-a", projectName: "Abia", generatedAt: 1, forms: [], places: [] };

type Make = () => RecordLookup;

/** The contract both sources must meet: the same pack gives the same answers whichever way it reaches the form. */
function contract(name: string, make: Make) {
  test(`${name}: lists the projects by name`, async () => {
    assert.deepEqual((await make().projects()).map((p) => p.name), ["Abia", "Borno WASH"]);
  });
  test(`${name}: a v2 project answers every part`, async () => {
    const l = make();
    assert.deepEqual((await l.indicators("p-b"))?.map((i) => i.code), ["A1"]);
    assert.deepEqual((await l.periods("p-b"))?.map((p) => p.id), ["per1"]);
    assert.deepEqual((await l.plan("p-b"))?.map((p) => p.title), ["Hygiene"]);
    assert.deepEqual((await l.places("p-b")).map((p) => p.id), ["pl1"]);
    assert.deepEqual((await l.forms("p-b")).map((f) => f.id), ["f1"]);
  });
  test(`${name}: a part the pack does not carry is null, not an empty list`, async () => {
    const l = make();
    assert.equal(await l.indicators("p-a"), null);
    assert.equal(await l.periods("p-a"), null);
    assert.equal(await l.plan("p-a"), null);
    assert.deepEqual(await l.places("p-a"), []);
    assert.deepEqual(await l.forms("p-a"), []);
  });
  test(`${name}: an unknown project is like a pack with nothing in it`, async () => {
    const l = make();
    assert.equal(await l.indicators("nope"), null);
    assert.deepEqual(await l.forms("nope"), []);
  });
}

contract("pack lookup", () => createPackLookup([v2, v1]));
contract("network lookup", () => createNetworkLookup({
  listProjects: async () => [v2, v1].map((p) => ({ id: p.projectId, name: p.projectName })).sort((a, b) => a.name.localeCompare(b.name)),
  fetchPack: async (id) => ([v2, v1].find((p) => p.projectId === id) ?? { ...v1, projectId: id, projectName: id }),
}));

test("the two sources say where they read from", () => {
  assert.equal(createPackLookup([v2]).source, "pack");
  assert.equal(createNetworkLookup({ listProjects: async () => [], fetchPack: async () => v2 }).source, "network");
});

test("network lookup asks the server once per project, however many parts a form reads", async () => {
  let calls = 0;
  const l = createNetworkLookup({ listProjects: async () => [], fetchPack: async () => { calls += 1; return v2; } });
  await Promise.all([l.indicators("p-b"), l.periods("p-b"), l.plan("p-b"), l.places("p-b"), l.forms("p-b")]);
  assert.equal(calls, 1);
});

test("a failed read is not remembered: the next ask tries again", async () => {
  let calls = 0;
  const l = createNetworkLookup({ listProjects: async () => [], fetchPack: async () => { calls += 1; if (calls === 1) throw new Error("offline"); return v2; } });
  await assert.rejects(() => l.indicators("p-b"));
  assert.deepEqual((await l.indicators("p-b"))?.map((i) => i.code), ["A1"]);
  assert.equal(calls, 2);
});

test("refresh makes the network source read the project again; for a pack it changes nothing", async () => {
  let calls = 0;
  const net = createNetworkLookup({ listProjects: async () => [], fetchPack: async () => { calls += 1; return v2; } });
  await net.indicators("p-b");
  net.refresh("p-b");
  await net.indicators("p-b");
  assert.equal(calls, 2);
  const pack = createPackLookup([v2]);
  pack.refresh("p-b");
  assert.deepEqual((await pack.indicators("p-b"))?.map((i) => i.code), ["A1"]);
});
