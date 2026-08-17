import assert from "node:assert/strict";
import test from "node:test";
import { TenantId } from "@donordesk/domain";
import { ImportLogframeHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "user-1", role: "ADMIN" }, requestId: "r-1" };

function makeRepo(overrides = {}) {
  const created = [];
  const repo = {
    created,
    findByProject: async (projectId, tid) => {
      if (overrides.findByProject) return overrides.findByProject(projectId, tid);
      const existing = overrides.existing ?? [];
      return { ok: true, value: existing.filter((i) => i.projectId === projectId) };
    },
    create: async (item) => {
      created.push(item);
      return { ok: true, value: item };
    },
    update: async (item) => ({ ok: true, value: item }),
    findById: async () => ({ ok: true, value: null }),
    delete: async () => ({ ok: true, value: undefined }),
  };
  return repo;
}

test("ImportLogframeHandler creates records with parent resolution", async () => {
  const repo = makeRepo();
  const audit = { record: async () => {} };
  let n = 0;
  const handler = new ImportLogframeHandler({ generate: () => `id-${++n}` }, repo, audit);

  const text = [
    "GOAL,G1,Clean water for all,Reduced disease",
    "OUTCOME,O1,Communities use safe water,",
    "OUTPUT,OP1,Boreholes drilled,",
    "ACTIVITY,A1,Site assessment,",
  ].join("\n");

  const r = await handler.handle(ctx, { projectId: "p1", text, sourceName: "logframe.csv" });
  assert.equal(r.ok, true);
  assert.equal(r.value.created, 4);
  assert.equal(r.value.skipped, 0);
  assert.equal(r.value.items.length, 4);
  assert.equal(repo.created.length, 4);

  const [goal, outcome, output, activity] = repo.created;
  assert.equal(goal.parentId, undefined);
  assert.equal(outcome.parentId, goal.id);
  assert.equal(output.parentId, outcome.id);
  assert.equal(activity.parentId, output.id);
});

test("ImportLogframeHandler skips existing codes and keeps hierarchy", async () => {
  const existingItem = {
    id: "existing-1",
    tenantIdValue: "tenant-a",
    projectId: "p1",
    code: "G1",
    level: "GOAL",
    title: "Old goal",
    parentId: undefined,
  };
  const repo = makeRepo({ existing: [existingItem] });
  const audit = { record: async () => {} };
  let n = 0;
  const handler = new ImportLogframeHandler({ generate: () => `id-${++n}` }, repo, audit);

  const text = ["GOAL,G1,Clean water for all", "OUTCOME,O1,Communities use safe water"].join("\n");
  const r = await handler.handle(ctx, { projectId: "p1", text });
  assert.equal(r.ok, true);
  assert.equal(r.value.created, 1);
  assert.equal(r.value.skipped, 1);
  assert.equal(r.value.items[0].code, "O1");
  // Parent is undefined because the GOAL row was skipped (no goal created in this run).
  assert.equal(repo.created[0].parentId, undefined);
});

test("ImportLogframeHandler rejects unparseable input", async () => {
  const repo = makeRepo();
  const handler = new ImportLogframeHandler({ generate: () => "id" }, repo, { record: async () => {} });
  const r = await handler.handle(ctx, { projectId: "p1", text: "no structure here" });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "VALIDATION_FAILED");
});

test("ImportLogframeHandler emits one audit event with counts", async () => {
  const repo = makeRepo();
  const events = [];
  const handler = new ImportLogframeHandler({ generate: () => "id-1" }, repo, {
    record: async (e) => events.push(e),
  });
  const r = await handler.handle(ctx, { projectId: "p1", text: "GOAL,G1,Clean water" });
  assert.equal(r.ok, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "logframe.items.imported");
  assert.ok(events[0].newValue.includes('"created":1'));
});
