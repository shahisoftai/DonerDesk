import assert from "node:assert/strict";
import test from "node:test";
import { GetExportPreflightHandler } from "../dist/index.js";

const ok = (value) => ({ ok: true, value });
const period = { id: "p1", projectId: "pr1", reportType: "MONTHLY", scope: {}, duration: { start: new Date("2026-03-01"), end: new Date("2026-03-31") } };
const file = (id, level = "INTERNAL") => ({ id, title: `File ${id}`, confidentialityLevel: level, verificationStatus: "VERIFIED" });

test("before the first draft the preflight still reports the evidence on file and the unverified values", async () => {
  const handler = new GetExportPreflightHandler(
    { findById: async () => ok(period) },
    { findByReportingPeriod: async () => ok([]) },
    {},
    { findByReportingPeriod: async () => ok([{ indicatorId: "i1", verificationStatus: "DRAFT" }, { indicatorId: "i2", verificationStatus: "VERIFIED" }]) },
    { findByReportingPeriod: async () => ok([{ status: "OPEN", type: "MISSING_ANNEX" }, { status: "RESOLVED", type: "MISSING_ANNEX" }]) },
    { search: async () => ok({ items: [file("e1"), file("e2"), file("e3", "SENSITIVE")], total: 3, page: 1, pageSize: 500 }) },
    {},
  );
  const result = await handler.handle({ tenant: { tenantId: "t1" } }, "p1");
  assert.equal(result.ok, true);
  assert.equal(result.value.draft, null);
  assert.equal(result.value.blocking[0].code, "NO_DRAFT");
  assert.equal(result.value.evidence.length, 3);
  assert.equal(result.value.sensitiveCount, 1);
  assert.equal(result.value.evidence.find((e) => e.id === "e3").defaultIncluded, false);
  assert.equal(result.value.unverifiedIndicatorCount, 1);
  assert.equal(result.value.annexGapCount, 1);
});

test("an open critical checklist item is listed once, not once by the gate and again by the checklist", async () => {
  const handler = new GetExportPreflightHandler(
    { findById: async () => ok(period) },
    { findByReportingPeriod: async () => ok([{ id: "d1", title: "T", status: "DRAFT", version: 1, generatedByAi: true }]) },
    { findByReportDraft: async () => ok([]) },
    { findByReportingPeriod: async () => ok([]) },
    { findByReportingPeriod: async () => ok([{ id: "c1", status: "OPEN", type: "MISSING_APPROVAL", severity: "CRITICAL", title: "Final report sign-off obtained" }]) },
    { search: async () => ok({ items: [], total: 0, page: 1, pageSize: 500 }) },
    { evaluateGate: async () => ok({ approvalBlocked: true, submitBlocked: true, submitNeedsDecision: false, blockReasons: ["Mandatory reporting requirement or annex is unsatisfied"], blockingIssues: [{ kind: "REQUIREMENT_UNSATISFIED", detail: "Open critical checklist item: Final report sign-off obtained" }] }) },
  );
  const result = await handler.handle({ tenant: { tenantId: "t1" } }, "p1");
  assert.equal(result.ok, true);
  assert.equal(result.value.blockingItems.filter((i) => /sign-off/i.test(i.message)).length, 1);
});
