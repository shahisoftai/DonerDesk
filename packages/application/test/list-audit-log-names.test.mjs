import assert from "node:assert/strict";
import test from "node:test";
import { ListAuditLogHandler } from "../dist/index.js";

const ctx = { tenant: { tenantId: "tenant-1" }, requestId: "r1" };
const rows = [
  { id: "a1", actorId: "u1", eventType: "evidence.verified" },
  { id: "a2", actorId: "*", eventType: "billing.reconciled" },
  { id: "a3", actorId: "gone", eventType: "comment.created" },
];
const repo = { async listByTenant() { return { ok: true, value: rows }; } };
let lookups = 0;
const users = { async findById(id) { lookups += 1; return { ok: true, value: id === "u1" ? { name: "Ada Okafor" } : null }; } };

test("each audit event carries the actor's name", async () => {
  const r = await new ListAuditLogHandler(repo, users).handle(ctx);
  assert.equal(r.ok, true);
  assert.equal(r.value[0].actorName, "Ada Okafor");
});

test("a platform job or a former member has no name and the event is still listed", async () => {
  const r = await new ListAuditLogHandler(repo, users).handle(ctx);
  assert.equal(r.value[1].actorName, undefined);
  assert.equal(r.value[2].actorName, undefined);
  assert.equal(r.value.length, 3);
});

test("a person is looked up once however many events they have", async () => {
  lookups = 0;
  await new ListAuditLogHandler({ async listByTenant() { return { ok: true, value: [rows[0], { ...rows[0], id: "a9" }] }; } }, users).handle(ctx);
  assert.equal(lookups, 1);
});

test("without a user repository the events are returned unchanged", async () => {
  const r = await new ListAuditLogHandler(repo).handle(ctx);
  assert.deepEqual(r.value, rows);
});
