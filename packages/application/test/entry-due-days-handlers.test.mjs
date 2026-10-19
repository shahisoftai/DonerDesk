import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { GetEntryDueDaysHandler, SetEntryDueDaysHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const VIEWER = ctxFor("v", "VIEWER");

function world(hasProfile = true) {
  const stored = new Map([["p", 5]]);
  const audit = [];
  const reader = { forProject: async (p) => stored.get(p) ?? 5 };
  const writer = { set: async (p, d) => (hasProfile ? (stored.set(p, d), true) : false) };
  return { stored, audit, get: new GetEntryDueDaysHandler(reader), set: new SetEntryDueDaysHandler(writer, { record: async (e) => void audit.push(e) }) };
}

test("a project manager sets the due days; it is validated, stored and audited; a viewer cannot", async () => {
  const w = world();
  assert.equal((await w.set.handle(VIEWER, "p", 10)).error.code, "FORBIDDEN");
  assert.equal((await w.set.handle(PM, "p", 61)).ok, false);
  assert.equal((await w.set.handle(PM, "p", 2.5)).ok, false);
  assert.equal(w.stored.get("p"), 5, "nothing stored on refusal");
  assert.deepEqual((await w.set.handle(PM, "p", 10)).value, { days: 10 });
  assert.equal((await w.get.handle(VIEWER, "p")).value.days, 10);
  assert.equal(w.audit.filter((e) => e.eventType === "project.entry_due_days_set").length, 1);
});

test("with no reporting profile there is nothing to change, and the message says what to do", async () => {
  const w = world(false);
  const res = await w.set.handle(PM, "p", 7);
  assert.equal(res.ok, false);
  assert.match(res.error.message, /reporting profile first/);
  assert.equal(w.audit.length, 0);
});
