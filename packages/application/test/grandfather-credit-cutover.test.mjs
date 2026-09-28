import assert from "node:assert/strict";
import test from "node:test";
import { UsageCounter, PLAN_CATALOG } from "@donordesk/domain";
import {
  RunGrandfatherCreditCutoverHandler,
  PHASE22_CREDIT_CUTOVERS,
  GRANDFATHER_CREDIT_CUTOVER_REASON_PREFIX,
} from "../dist/index.js";

function fakeAudit() {
  const records = [];
  return { records, record: async (input) => { records.push(input); return { ok: true, value: undefined }; } };
}

function fakeClock(iso = "2026-10-15T00:00:00Z") {
  return { now: () => new Date(iso) };
}

function fakeSubscriptions(subs) {
  return {
    create: async () => { throw new Error("not used"); },
    update: async () => { throw new Error("not used"); },
    findByProviderSubscriptionId: async () => ({ ok: true, value: null }),
    findAccessGrantingByTenant: async () => ({ ok: true, value: null }),
    listReconcileCandidates: async () => ({ ok: true, value: [] }),
    listActiveByPlanCodes: async (planCodes) => ({ ok: true, value: subs.filter((s) => planCodes.includes(s.planCode)) }),
  };
}

function fakeGrants(store) {
  return {
    create: async (g) => { store.push(g); return { ok: true, value: g }; },
    listByTenant: async (tenantId) => ({ ok: true, value: store.filter((g) => g.tenantId === tenantId) }),
    listEffectiveByTenant: async (tenantId, now) => ({
      ok: true,
      value: store.filter((g) => g.tenantId === tenantId && g.isEffectiveAt(now)),
    }),
    listExpiredTrialGrants: async () => ({ ok: true, value: [] }),
  };
}

function fakeUsage(usedByTenant) {
  return {
    get: async (tenantId, metric, periodStart) => ({
      ok: true,
      value: UsageCounter.create({ metric, periodStart, used: BigInt(usedByTenant[tenantId] ?? 0), reserved: 0n }),
    }),
    add: async () => { throw new Error("not used"); },
    setUsed: async () => { throw new Error("not used"); },
    listByMetric: async () => ({ ok: true, value: [] }),
  };
}

function handlerFor({ subs, usedByTenant, grantsStore = [], now = "2026-10-15T00:00:00Z" }) {
  const audit = fakeAudit();
  const handler = new RunGrandfatherCreditCutoverHandler(
    fakeSubscriptions(subs),
    fakeGrants(grantsStore),
    fakeUsage(usedByTenant),
    audit,
    fakeClock(now),
  );
  return { handler, audit, grantsStore };
}

test("grandfathers a TEAM tenant already past the new 20-credit cap, preserving the old 100 allowance", async () => {
  const subs = [{ tenantId: "tenant-a", planCode: "TEAM" }];
  const { handler, audit, grantsStore } = handlerFor({ subs, usedByTenant: { "tenant-a": 35 } });

  const result = await handler.handle({ cutovers: PHASE22_CREDIT_CUTOVERS });
  assert.equal(result.ok, true);
  assert.equal(result.value.length, 1);
  assert.equal(result.value[0].tenantId, "tenant-a");
  assert.equal(result.value[0].grantedAllowance, 100);
  assert.equal(result.value[0].usedThisMonth, 35);

  assert.equal(grantsStore.length, 1);
  const grant = grantsStore[0];
  assert.equal(grant.source, "GRANDFATHERED");
  assert.equal(grant.tenantId, "tenant-a");
  assert.ok(grant.reason.startsWith(GRANDFATHER_CREDIT_CUTOVER_REASON_PREFIX));
  assert.equal(grant.effectiveUntil.toISOString(), "2026-11-01T00:00:00.000Z");

  // Full PlanLimitsJson persisted, not just the credit bucket, so calculateEntitlement
  // never sees an `undefined` maxActiveProjects/maxSeats/etc for this override.
  const limits = JSON.parse(grant.overrideLimitsJson);
  assert.equal(limits.monthlyAiDraftCredits, 100);
  assert.equal(limits.maxActiveProjects, PLAN_CATALOG.TEAM.maxActiveProjects);
  assert.equal(limits.maxSeats, PLAN_CATALOG.TEAM.maxSeats);
  assert.equal(limits.viewerSeats, PLAN_CATALOG.TEAM.viewerSeats);
  assert.equal(limits.byoLlmEnabled, PLAN_CATALOG.TEAM.byoLlmEnabled);

  assert.equal(audit.records.length, 1);
  assert.equal(audit.records[0].eventType, "billing.credits.grandfathered");
});

test("skips a tenant whose usage is already within the new cap", async () => {
  const subs = [{ tenantId: "tenant-b", planCode: "TEAM" }];
  const { handler, grantsStore } = handlerFor({ subs, usedByTenant: { "tenant-b": 12 } });

  const result = await handler.handle({ cutovers: PHASE22_CREDIT_CUTOVERS });
  assert.equal(result.ok, true);
  assert.equal(result.value.length, 0);
  assert.equal(grantsStore.length, 0);
});

test("grandfathers a GROWTH tenant past the new 100-credit cap, preserving the old 500 allowance", async () => {
  const subs = [{ tenantId: "tenant-c", planCode: "GROWTH" }];
  const { handler, grantsStore } = handlerFor({ subs, usedByTenant: { "tenant-c": 250 } });

  const result = await handler.handle({ cutovers: PHASE22_CREDIT_CUTOVERS });
  assert.equal(result.ok, true);
  assert.equal(result.value[0].grantedAllowance, 500);
  assert.equal(grantsStore[0].planCode, "GROWTH");
});

test("re-running the migration is idempotent: an already-grandfathered tenant is not double-granted", async () => {
  const subs = [{ tenantId: "tenant-a", planCode: "TEAM" }];
  const grantsStore = [];
  const usedByTenant = { "tenant-a": 35 };

  const first = handlerFor({ subs, usedByTenant, grantsStore });
  const firstResult = await first.handler.handle({ cutovers: PHASE22_CREDIT_CUTOVERS });
  assert.equal(firstResult.value.length, 1);
  assert.equal(grantsStore.length, 1);

  // Second run reuses the same grant store (simulating a re-run of the job).
  const second = handlerFor({ subs, usedByTenant, grantsStore });
  const secondResult = await second.handler.handle({ cutovers: PHASE22_CREDIT_CUTOVERS });
  assert.equal(secondResult.ok, true);
  assert.equal(secondResult.value.length, 0, "second run must skip the already-grandfathered tenant");
  assert.equal(grantsStore.length, 1, "no duplicate grant was written");
});

test("ignores tenants on plans with no configured cutover", async () => {
  const subs = [{ tenantId: "tenant-d", planCode: "ENTERPRISE" }];
  const { handler, grantsStore } = handlerFor({ subs, usedByTenant: { "tenant-d": 99999 } });

  const result = await handler.handle({ cutovers: PHASE22_CREDIT_CUTOVERS });
  assert.equal(result.ok, true);
  assert.equal(result.value.length, 0);
  assert.equal(grantsStore.length, 0);
});
