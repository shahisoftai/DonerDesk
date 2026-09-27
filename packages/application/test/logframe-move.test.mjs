import assert from "node:assert/strict";
import test from "node:test";
import { CreateLogframeItemHandler, MoveLogframeItemHandler, ListLogframeHandler } from "../dist/index.js";
import { TenantId, LogframeItem } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "user-1", role: "ADMIN" }, requestId: "r" };

let clock = 0;
function item(id, level, parentId, code = id) {
  return LogframeItem.rehydrate({
    id, tenantId: "tenant-a", projectId: "p1", createdAt: new Date(++clock * 1000),
    props: { level, parentId, code, title: `Item ${id}` },
  });
}

function repo(items) {
  return {
    items, positions: [], created: [],
    async findById(id) { return { ok: true, value: this.items.find((i) => i.id === id) ?? null }; },
    async findByProject() { return { ok: true, value: [...this.items] }; },
    async create(i) { this.created.push(i); this.items.push(i); return { ok: true, value: i }; },
    async savePositions(list) { this.positions.push(list.map((i) => `${i.id}@${i.parentId ?? "-"}#${i.sortOrder}`)); return { ok: true, value: undefined }; },
  };
}
const audit = () => ({ events: [], async record(e) { this.events.push(e); } });
const ids = { generate: () => "new" };

test("create appends under a valid parent and rejects an invalid level", async () => {
  const r = repo([item("g", "GOAL"), item("o1", "OUTCOME", "g")]);
  const ok = await new CreateLogframeItemHandler(ids, r, audit()).handle(ctx, { projectId: "p1", parentId: "g", level: "OUTCOME", title: "Second outcome" });
  assert.equal(ok.ok, true);
  assert.equal(r.created[0].parentId, "g");
  assert.equal(r.created[0].sortOrder, 1);

  const r2 = repo([item("o1", "OUTCOME")]);
  const bad = await new CreateLogframeItemHandler(ids, r2, audit()).handle(ctx, { projectId: "p1", parentId: "o1", level: "GOAL", title: "Goal under outcome" });
  assert.equal(bad.ok, false);
  assert.equal(r2.created.length, 0);
});

test("move persists positions in one call and audits", async () => {
  const r = repo([item("g", "GOAL"), item("o1", "OUTCOME", "g", "1"), item("o2", "OUTCOME", "g", "2")]);
  const a = audit();
  const res = await new MoveLogframeItemHandler(r, a).handle(ctx, "o2", { parentId: "g", index: 0 });
  assert.equal(res.ok, true);
  assert.equal(r.positions.length, 1);
  assert.deepEqual(r.positions[0], ["o1@g#1"]);
  assert.equal(a.events[0].eventType, "logframe.item.moved");

  const listed = await new ListLogframeHandler(r, { async findByProject() { return { ok: true, value: [] }; } }).handle(ctx, "p1");
  assert.deepEqual(listed.value.items.map((i) => i.id), ["g", "o2", "o1"]);
});

test("a no-op move writes no audit event", async () => {
  const r = repo([item("g", "GOAL")]);
  const a = audit();
  assert.equal((await new MoveLogframeItemHandler(r, a).handle(ctx, "g", { parentId: null, index: 0 })).ok, true);
  assert.equal(a.events.length, 0);
});
