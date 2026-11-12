import assert from "node:assert/strict";
import test from "node:test";
import { UpdateLogframeItemHandler } from "../dist/index.js";
import { TenantId, LogframeItem } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u1", role: "PROJECT_MANAGER" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });

function world(found = true) {
  const state = { item: LogframeItem.create({ id: "i1", tenantId: "tenant-a", projectId: "p1", level: "OUTPUT", code: "OUT-1", title: "Trained staff" }), saved: 0, audits: [] };
  const repo = { findById: async () => ok(found ? state.item : null), update: async (i) => (state.saved++, ok(i)) };
  return { state, handler: new UpdateLogframeItemHandler(repo, { record: async (e) => { state.audits.push(e); } }) };
}

test("52.1: a result's words are corrected, saved and audited with the before and after", async () => {
  const w = world();
  const r = await w.handler.handle(ctx, "i1", { title: "Trained health staff", assumptions: "Staff stay in post", rationale: "Trained staff screen more children" });
  assert.equal(r.ok, true);
  assert.equal(w.state.item.title, "Trained health staff");
  assert.equal(w.state.item.assumptions, "Staff stay in post");
  assert.equal(w.state.saved, 1);
  assert.equal(w.state.audits[0].eventType, "logframe.item.updated");
  assert.match(w.state.audits[0].oldValue, /Trained staff/);
  assert.match(w.state.audits[0].newValue, /Staff stay in post/);
});

test("52.1: saving the same words writes nothing and audits nothing", async () => {
  const w = world();
  assert.equal((await w.handler.handle(ctx, "i1", { title: "Trained staff" })).ok, true);
  assert.equal(w.state.saved, 0);
  assert.equal(w.state.audits.length, 0);
});

test("52.1: an unknown result, or a title too short, is refused with a sentence", async () => {
  assert.equal((await world(false).handler.handle(ctx, "nope", { title: "Anything" })).ok, false);
  const w = world();
  const r = await w.handler.handle(ctx, "i1", { title: "x" });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /title required/);
  assert.equal(w.state.saved, 0);
});
