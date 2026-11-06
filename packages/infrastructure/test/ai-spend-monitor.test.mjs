import assert from "node:assert/strict";
import test from "node:test";
import { checkAiSpend, spendAlertThresholdUsd } from "../dist/ai/spend-monitor.js";

const repo = (rows) => ({ costByTenantSince: async (since) => { repo.since = since; return { ok: true, value: rows }; } });
const logger = () => ({ errors: [], error(m, d) { this.errors.push([m, d]); }, info() {}, warn() {} });

test("H-19: an organisation over the monthly threshold raises an error-level alert; others do not", async () => {
  const log = logger();
  const n = await checkAiSpend(repo([{ tenantId: "big", costUsd: 40.126, calls: 900 }, { tenantId: "small", costUsd: 3, calls: 20 }]), log, new Date("2026-10-21T12:00:00Z"), 25);
  assert.equal(n, 1);
  assert.deepEqual(log.errors, [["ai.spend_alert", { tenantId: "big", monthCostUsd: 40.13, calls: 900, thresholdUsd: 25 }]]);
  assert.equal(repo.since.toISOString(), "2026-10-01T00:00:00.000Z", "the window is the calendar month, UTC");
});

test("H-19: a threshold of 0 turns the check off; the default is 25", async () => {
  const log = logger();
  assert.equal(await checkAiSpend(repo([{ tenantId: "x", costUsd: 999, calls: 1 }]), log, new Date(), 0), 0);
  assert.equal(log.errors.length, 0);
  assert.equal(spendAlertThresholdUsd(undefined), 25);
  assert.equal(spendAlertThresholdUsd("5"), 5);
  assert.equal(spendAlertThresholdUsd("junk"), 25);
});
