import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { AddCommentHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "author", role: "FIELD_OFFICER" }, requestId: "r" };

function world(target) {
  const sent = [], saved = [], audit = [];
  const repo = { create: async (c) => (saved.push(c), { ok: true, value: c }) };
  const h = new AddCommentHandler({ generate: () => "c1" }, repo, { record: async (e) => void audit.push(e) }, { send: async (n) => void sent.push(n) }, { resolve: async () => target });
  return { h, sent, saved, audit };
}

test("a comment on a missing item is refused and nothing is saved", async () => {
  const w = world(null);
  const r = await w.h.handle(ctx, { entityType: "planned_activity", entityId: "x", commentText: "hi" });
  assert.equal(r.ok, false);
  assert.equal(w.saved.length, 0);
});
test("owners and the mentioned person are told once; the author is not", async () => {
  const w = world({ title: "Outreach", owners: ["author", "lead", "m"] });
  const r = await w.h.handle(ctx, { entityType: "planned_activity", entityId: "pa1", commentText: "Road is shut", mentionedUserId: "m" });
  assert.equal(r.ok, true);
  assert.deepEqual(w.sent.map((n) => n.recipientId), ["m", "lead"]);
  assert.match(w.sent[0].title, /planned activity/);
  assert.equal(w.audit.length, 1);
});
