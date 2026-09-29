import assert from "node:assert/strict";
import test from "node:test";
import { UsageCounter } from "@donordesk/domain";
import { RunGrandfatherByoLlmHandler, GRANDFATHER_BYO_LLM_REASON_PREFIX, EntitlementService } from "../dist/index.js";

function fakeAudit() {
  const records = [];
  return { records, record: async (input) => { records.push(input); return { ok: true, value: undefined }; } };
}

function fakeClock(iso = "2026-10-15T00:00:00Z") {
  return { now: () => new Date(iso) };
}

function fakeLlmConfigs(tenantIds) {
  return { listEnabledTenantScopeIds: async () => ({ ok: true, value: tenantIds }) };
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

function starterGrant(tenantId, planCode) {
  return {
    id: `g-${tenantId}`,
    tenantId,
    planCode,
    source: "DEFAULT",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveUntil: undefined,
    overrideLimitsJson: null,
    reason: "test",
    createdById: "user-a",
    isEffectiveAt: () => true,
  };
}

function makeEntitlementService(grantsStore, planCodeByTenant) {
  return new EntitlementService(
    { listEffectiveByTenant: async (tenantId, now) => ({ ok: true, value: grantsStore.filter((g) => g.tenantId === tenantId && g.isEffectiveAt(now)) }), listExpiredTrialGrants: async () => ({ ok: true, value: [] }) },
    { findAccessGrantingByTenant: async () => ({ ok: true, value: null }) },
    { get: async (tenantId, metric, periodStart) => ({ ok: true, value: UsageCounter.create({ metric, periodStart, used: 0n, reserved: 0n }) }) },
    { listByTenant: async () => ({ ok: true, value: [] }) },
    { listByTenant: async () => ({ ok: true, value: [] }) },
  );
}

test("grandfathers a TEAM tenant with a working BYO-LLM config via a permanent MANUAL override", async () => {
  const grantsStore = [starterGrant("tenant-a", "TEAM")];
  const audit = fakeAudit();
  const entitlements = makeEntitlementService(grantsStore, { "tenant-a": "TEAM" });
  const handler = new RunGrandfatherByoLlmHandler(
    fakeLlmConfigs(["tenant-a"]),
    fakeGrants(grantsStore),
    entitlements,
    audit,
    fakeClock(),
  );

  const result = await handler.handle();
  assert.equal(result.ok, true);
  assert.equal(result.value.length, 1);
  assert.equal(result.value[0].tenantId, "tenant-a");
  assert.equal(result.value[0].planCode, "TEAM");

  const grant = grantsStore.find((g) => g.source === "MANUAL");
  assert.ok(grant);
  assert.ok(grant.reason.startsWith(GRANDFATHER_BYO_LLM_REASON_PREFIX));
  assert.equal(grant.effectiveUntil, undefined); // permanent, unlike the time-bounded credit cutover
  const limits = JSON.parse(grant.overrideLimitsJson);
  assert.equal(limits.byoLlmEnabled, true);
  assert.equal(limits.monthlyAiDraftCredits, 20); // rest of TEAM's limits preserved, not left undefined

  assert.equal(audit.records.some((r) => r.eventType === "billing.byo_llm.grandfathered"), true);
});

test("skips a GROWTH tenant: byoLlmEnabled is already true on that plan", async () => {
  const grantsStore = [starterGrant("tenant-b", "GROWTH")];
  const entitlements = makeEntitlementService(grantsStore);
  const handler = new RunGrandfatherByoLlmHandler(fakeLlmConfigs(["tenant-b"]), fakeGrants(grantsStore), entitlements, fakeAudit(), fakeClock());

  const result = await handler.handle();
  assert.equal(result.ok, true);
  assert.equal(result.value.length, 0);
  assert.equal(grantsStore.length, 1); // only the original STARTER-like base grant
});

test("re-running the migration never double-grants (idempotent)", async () => {
  const grantsStore = [starterGrant("tenant-a", "TEAM")];
  const entitlements = makeEntitlementService(grantsStore);
  const handler = new RunGrandfatherByoLlmHandler(fakeLlmConfigs(["tenant-a"]), fakeGrants(grantsStore), entitlements, fakeAudit(), fakeClock());

  const first = await handler.handle();
  assert.equal(first.value.length, 1);
  const second = await handler.handle();
  assert.equal(second.ok, true);
  assert.equal(second.value.length, 0);
  assert.equal(grantsStore.filter((g) => g.source === "MANUAL").length, 1);
});
