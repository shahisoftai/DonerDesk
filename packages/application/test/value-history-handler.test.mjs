import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { GetIndicatorValueHistoryHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "amina", role: "VIEWER" }, requestId: "r" };
const day = (d) => new Date(`2026-10-${d}T08:00:00Z`);
function build({ exists = true, events = [] } = {}) {
  const queries = [];
  const updates = { findById: async () => ({ ok: true, value: exists ? { id: "u1" } : null }) };
  const audit = { listByTenant: async (_t, options) => { queries.push(options); return { ok: true, value: events }; } };
  const users = { findById: async (id) => ({ ok: true, value: id === "amina" ? { name: "Amina" } : null }) };
  return { handler: new GetIndicatorValueHistoryHandler(updates, audit, users), queries };
}

test("the history of a value is read from its own audit events, with the people's names", async () => {
  const { handler, queries } = build({ events: [
    { id: "1", actorId: "amina", eventType: "logframe.indicator.updated", entityType: "indicator_update", entityId: "u1", oldValue: "", newValue: "10", createdAt: day("01") },
    { id: "2", actorId: "ghost", eventType: "logframe.indicator.verified", entityType: "indicator_update", entityId: "u1", createdAt: day("02") },
  ] });
  const r = await handler.handle(ctx, "u1");
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.entries.map((e) => [e.what, e.by, e.change]), [["Verified", "", undefined], ["Saved", "Amina", "empty → 10"]]);
  assert.deepEqual(queries[0], { entityType: "indicator_update", entityId: "u1", limit: 200 });
});

test("a value that does not exist is not found, and its audit trail is not read", async () => {
  const { handler, queries } = build({ exists: false });
  const r = await handler.handle(ctx, "nope");
  assert.equal(r.ok, false);
  assert.equal(queries.length, 0);
});
