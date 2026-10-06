import assert from "node:assert/strict";
import test from "node:test";
import { TenantId } from "@donordesk/domain";
import { CreateAllPeriodsHandler } from "../dist/index.js";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u-1", role: "ADMIN" }, requestId: "r" };
const project = (reportingFrequency = "MONTHLY") => ({ reportingFrequency, duration: { start: new Date("2026-03-01"), end: new Date("2026-08-31") } });

function build({ frequency = "MONTHLY", existingEnds = [], deadlineOffset, failOn } = {}) {
  const calls = [];
  const handler = new CreateAllPeriodsHandler(
    { findById: async () => ({ ok: true, value: project(frequency) }) },
    { findByProject: async () => ({ ok: true, value: deadlineOffset === undefined ? null : { deadlineOffsetDays: deadlineOffset } }) },
    { findByProject: async () => ({ ok: true, value: existingEnds.map((e) => ({ duration: { end: new Date(e) } })) }) },
    { handle: async (_ctx, input) => { calls.push(input); return failOn && input.startDate.startsWith(failOn) ? { ok: false, error: new Error("overlaps") } : { ok: true, value: { id: `p${calls.length}` } }; } },
  );
  return { handler, calls };
}

test("the preview equals what is created: five months, the sixth is the closing report's", async () => {
  const { handler, calls } = build();
  const preview = await handler.preview(ctx, "pr");
  assert.equal(preview.value.plan.periods.length, 5);
  assert.equal(preview.value.plan.closing.startDate, "2026-08-01");
  const r = await handler.handle(ctx, "pr");
  assert.equal(r.value.created.length, 5);
  assert.deepEqual(calls.map((c) => c.startDate.slice(0, 10)), preview.value.plan.periods.map((p) => p.startDate));
  assert.equal(calls[0].reportType, "MONTHLY");
  assert.equal(calls[0].deadline.slice(0, 10), "2026-04-30", "default 30-day deadline offset");
});

test("the profile's deadline offset is used", async () => {
  const { handler, calls } = build({ deadlineOffset: 10 });
  await handler.handle(ctx, "pr");
  assert.equal(calls[0].deadline.slice(0, 10), "2026-04-10");
});

test("one refused period is reported and does not stop the rest", async () => {
  const { handler } = build({ failOn: "2026-04" });
  const r = await handler.handle(ctx, "pr");
  assert.equal(r.value.created.length, 4);
  assert.deepEqual(r.value.failed.map((f) => [f.startDate, f.error]), [["2026-04-01", "overlaps"]]);
});

test("already-created periods are not created again; running twice is harmless", async () => {
  const { handler, calls } = build({ existingEnds: ["2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30", "2026-07-31"] });
  const r = await handler.handle(ctx, "pr");
  assert.equal(r.value.created.length, 0);
  assert.equal(calls.length, 0);
});

test("a frequency without a monthly or quarterly cadence plans nothing and says why", async () => {
  const { handler, calls } = build({ frequency: "ANNUAL" });
  const preview = await handler.preview(ctx, "pr");
  assert.equal(preview.value.reportType, null);
  assert.match(preview.value.note, /one at a time/);
  assert.deepEqual((await handler.handle(ctx, "pr")).value, { created: [], failed: [] });
  assert.equal(calls.length, 0);
});
