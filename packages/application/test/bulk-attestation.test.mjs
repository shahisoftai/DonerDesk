import assert from "node:assert/strict";
import test from "node:test";
import { BulkResolveChecklistHandler, ResolveChecklistItemHandler } from "../dist/index.js";
import { ChecklistItem, TenantId } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const as = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const item = (id, type) => ChecklistItem.create({ id, tenantId: "tenant-a", projectId: "p", reportingPeriodId: "per", type, title: id, description: "d", severity: "MEDIUM" });

function build() {
  const items = new Map([["sign", item("sign", "MISSING_APPROVAL")], ["sens", item("sens", "SENSITIVE_DATA_WARNING")], ["act", item("act", "LATE_ACTIVITY_UPDATE")]]);
  const audits = [];
  const repo = { findById: async (id) => ({ ok: true, value: items.get(id) ?? null }), update: async (i) => ({ ok: true, value: i }) };
  const audit = { record: async (e) => { audits.push(e); } };
  return { items, audits, bulk: new BulkResolveChecklistHandler(repo, audit), single: new ResolveChecklistItemHandler(repo, audit) };
}
const all = { itemIds: ["sign", "sens", "act"], decision: "RESOLVE", notes: "done" };

test("an administrator attests in bulk and each attestation names who made it (25.8)", async () => {
  const w = build();
  const r = await w.bulk.handle(as("pm-1", "PROJECT_MANAGER"), all);
  assert.deepEqual(r.value, { resolved: 3, skipped: 0, notPermitted: 0 });
  assert.equal(w.items.get("sign").attestedById, "pm-1");
  assert.equal(w.items.get("sens").attestedById, "pm-1");
  assert.equal(w.items.get("act").attestedById, undefined, "a state item is closed by data, not attested");
});

test("anyone else cannot attest in bulk: the attestations are left for them to decide one by one", async () => {
  const w = build();
  const r = await w.bulk.handle(as("me-1", "ME_OFFICER"), all);
  assert.deepEqual(r.value, { resolved: 1, skipped: 0, notPermitted: 2 });
  assert.equal(w.items.get("sign").status, "OPEN");
  assert.equal(w.items.get("act").status, "RESOLVED");
  await w.single.handle(as("me-1", "ME_OFFICER"), "sign", { decision: "RESOLVE", notes: "I checked." });
  assert.equal(w.items.get("sign").attestedById, "me-1");
  await w.single.handle(as("me-1", "ME_OFFICER"), "sign", { decision: "REOPEN" });
  assert.equal(w.items.get("sign").attestedById, undefined, "reopening clears the attestation");
});
