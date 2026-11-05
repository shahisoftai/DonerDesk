import test from "node:test";
import assert from "node:assert/strict";
import { SetProjectDeadlineOffsetHandler } from "../dist/index.js";

const ctx = { tenant: { tenantId: "t1", userId: "u1" } };
const profile = (days) => { const p = { id: "pr1", deadlineOffsetDays: days, update(i) { this.deadlineOffsetDays = i.deadlineOffsetDays; } }; return p; };
const make = (p) => { const audits = []; const saved = []; const h = new SetProjectDeadlineOffsetHandler({ findByProject: async () => ({ ok: true, value: p }), update: async (x) => { saved.push(x); return { ok: true, value: x }; } }, { record: async (e) => { audits.push(e); } }); return { h, audits, saved }; };

test("sets the days, audits it, and does nothing when they are already set", async () => {
  const p = profile(5); const { h, audits, saved } = make(p);
  assert.equal((await h.handle(ctx, "proj", 15)).ok, true);
  assert.equal(p.deadlineOffsetDays, 15); assert.equal(saved.length, 1); assert.equal(audits.length, 1);
  assert.equal((await h.handle(ctx, "proj", 15)).ok, true);
  assert.equal(saved.length, 1, "a repeat writes nothing");
});

test("refuses days outside 0..365 and a project with no profile", async () => {
  const { h } = make(profile(5));
  for (const bad of [-1, 366, 2.5]) assert.equal((await h.handle(ctx, "proj", bad)).ok, false);
  const none = make(null);
  assert.equal((await none.h.handle(ctx, "proj", 10)).ok, false);
});
