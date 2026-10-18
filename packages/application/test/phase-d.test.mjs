import assert from "node:assert/strict";
import test from "node:test";
import { RecomputeReadinessHandler } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "user-1", role: "ADMIN" }, requestId: "r-1" };

test("recompute-readiness handler delegates to calculate readiness", async () => {
  let called;
  const delegate = { handle: async (_c, reportingPeriodId) => { called = reportingPeriodId; return { ok: true, value: { score: 1 } }; } };
  const handler = new RecomputeReadinessHandler(delegate);
  const result = await handler.handle(ctx, "period-1");
  assert.equal(result.ok, true);
  assert.equal(called, "period-1");
});

// The old deadline-reminders handler was replaced by RunRemindersHandler (Phase 28.5); its behaviour is covered in reminders-handler.test.mjs.
