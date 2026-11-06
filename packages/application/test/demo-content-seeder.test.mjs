import test from "node:test";
import assert from "node:assert/strict";
import { DemoContentSeeder, firstQuarter } from "../dist/index.js";

const ok = (value) => ({ ok: true, value });
const refuse = (message) => ({ ok: false, error: new Error(message) });
const ctx = { tenant: { tenantId: { toString: () => "t" }, userId: "u" } };

function handlers(over = {}) {
  const calls = [];
  const h = {
    acknowledgeSetup: { handle: async () => (calls.push("setup"), ok({})) },
    createPeriod: { handle: async (_c, i) => (calls.push(["period", i]), ok({ id: "p1" })) },
    createIndicatorValue: { handle: async (_c, i) => (calls.push(["value", i.indicatorId, i.periodAchievement]), ok({ id: `u-${i.indicatorId}` })) },
    verifyIndicatorValue: { handle: async (_c, id) => (calls.push(["verify", id]), ok(undefined)) },
    createActivity: { handle: async (_c, i) => (calls.push(["activity", i.activityTitle]), ok({ id: `a${calls.length}` })) },
    reviewActivity: { handle: async (_c, id) => (calls.push(["accept", id]), ok(undefined)) },
    ...over,
  };
  return { h, calls };
}
const target = { projectId: "proj", startDate: new Date("2026-07-01T00:00:00Z"), outputId: "o1", indicators: [{ id: "i1", code: "IND-1" }, { id: "i2", code: "IND-2" }, { id: "x", code: "OTHER" }] };

test("the first quarter ends on the last day of its third month", () => {
  assert.equal(firstQuarter(new Date("2026-07-01T00:00:00Z")).end.toISOString().slice(0, 10), "2026-09-30");
});

test("set-up is confirmed first, then a period, a verified value per known indicator and two accepted activities", async () => {
  const { h, calls } = handlers();
  const r = await new DemoContentSeeder(h, () => new Date("2026-10-21T00:00:00Z")).seed(ctx, target);
  assert.deepEqual(r, { seeded: true });
  assert.equal(calls[0], "setup");
  assert.equal(calls[1][0], "period");
  assert.equal(calls[1][1].endDate.slice(0, 10), "2026-09-30");
  assert.ok(new Date(calls[1][1].deadline) >= new Date("2026-10-21T00:00:00Z"), "the deadline is not already past");
  assert.deepEqual(calls.filter((c) => c[0] === "value").map((c) => [c[1], c[2]]), [["i1", "1320"], ["i2", "78"]]);
  assert.equal(calls.filter((c) => c[0] === "verify").length, 2);
  assert.equal(calls.filter((c) => c[0] === "activity").length, 2);
  assert.equal(calls.filter((c) => c[0] === "accept").length, 2);
});

test("a refusal stops the seeding and says why; the demo itself is not lost", async () => {
  const { h } = handlers({ createPeriod: { handle: async () => refuse("project is not set up") } });
  const r = await new DemoContentSeeder(h).seed(ctx, target);
  assert.deepEqual(r, { seeded: false, reason: "project is not set up" });
  const { h: h2 } = handlers({ verifyIndicatorValue: { handle: async () => refuse("needs a file") } });
  assert.equal((await new DemoContentSeeder(h2).seed(ctx, target)).reason, "needs a file");
});
