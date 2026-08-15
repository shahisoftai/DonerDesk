import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAN_CATALOG,
  PLAN_CATALOG_VERSION,
  EntitlementGrant,
  BillingSubscription,
  UsageCounter,
  calculateEntitlement,
  DomainError,
  planLimitsToJson,
  planLimitsFromJson,
  isPlanCode,
  resolvePlan,
  isPlanForTrial,
} from "../dist/index.js";

test("plan catalog defines the four commercial plans", () => {
  assert.equal(isPlanCode("STARTER"), true);
  assert.equal(isPlanCode("TEAM"), true);
  assert.equal(isPlanCode("GROWTH"), true);
  assert.equal(isPlanCode("ENTERPRISE"), true);
  assert.equal(isPlanCode("NOPE"), false);

  assert.equal(PLAN_CATALOG.STARTER.monthlyPriceUsd, 0);
  assert.equal(PLAN_CATALOG.TEAM.monthlyPriceUsd, 59);
  assert.equal(PLAN_CATALOG.GROWTH.monthlyPriceUsd, 149);
  assert.equal(PLAN_CATALOG.ENTERPRISE.maxActiveProjects, null);

  // Team/Growth are trial-eligible; Starter/Enterprise are not.
  assert.equal(isPlanForTrial("TEAM"), true);
  assert.equal(isPlanForTrial("GROWTH"), true);
  assert.equal(isPlanForTrial("STARTER"), false);
  assert.equal(isPlanForTrial("ENTERPRISE"), false);
});

test("plan limits resolve from the catalog and round-trip JSON-safe", () => {
  const team = resolvePlan("TEAM");
  assert.equal(team.maxActiveProjects, 5);
  assert.equal(team.maxSeats, 5);
  assert.equal(team.maxManagedStorageBytes, 25n * 1024n * 1024n * 1024n);
  assert.equal(team.monthlyAiDraftCredits, 100);

  const json = planLimitsToJson({
    maxActiveProjects: 5,
    maxSeats: 5,
    maxManagedStorageBytes: 25n * 1024n * 1024n * 1024n,
    monthlyAiDraftCredits: 100,
  });
  assert.equal(json.maxManagedStorageBytes, "26843545600");
  const back = planLimitsFromJson(json);
  assert.equal(back.maxManagedStorageBytes, 25n * 1024n * 1024n * 1024n);
});

test("calculateEntitlement falls back to Starter when no grant is effective", () => {
  const now = new Date("2026-01-15T00:00:00Z");
  const snapshot = calculateEntitlement([], { activeProjects: 0, seats: 0, managedStorageBytes: 0n, aiDraftCreditsUsed: 0 }, now);
  assert.equal(snapshot.planCode, "STARTER");
  assert.equal(snapshot.source, "DEFAULT");
  assert.equal(snapshot.limits.maxActiveProjects, 1);
  assert.equal(snapshot.isTrial, false);
});

test("calculateEntitlement ignores expired trial grants (lazy expiry)", () => {
  const now = new Date("2026-01-15T00:00:00Z");
  const expiredTrial = {
    planCode: "TEAM",
    source: "TRIAL",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveUntil: new Date("2026-01-10T00:00:00Z"),
  };
  const snapshot = calculateEntitlement([expiredTrial], { activeProjects: 0, seats: 0, managedStorageBytes: 0n, aiDraftCreditsUsed: 0 }, now);
  assert.equal(snapshot.planCode, "STARTER");
});

test("calculateEntitlement applies an active trial grant and reports the trial window", () => {
  const now = new Date("2026-01-15T00:00:00Z");
  const trial = {
    planCode: "GROWTH",
    source: "TRIAL",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveUntil: new Date("2026-01-29T00:00:00Z"),
  };
  const snapshot = calculateEntitlement([trial], { activeProjects: 2, seats: 3, managedStorageBytes: 0n, aiDraftCreditsUsed: 5 }, now);
  assert.equal(snapshot.planCode, "GROWTH");
  assert.equal(snapshot.source, "TRIAL");
  assert.equal(snapshot.isTrial, true);
  assert.equal(snapshot.limits.maxActiveProjects, 20);
});

test("calculateEntitlement computes overLimit from current usage", () => {
  const now = new Date("2026-01-15T00:00:00Z");
  const starter = { planCode: "STARTER", source: "DEFAULT", effectiveFrom: new Date("2026-01-01T00:00:00Z") };
  const snapshot = calculateEntitlement(
    [starter],
    { activeProjects: 3, seats: 2, managedStorageBytes: 2n * 1024n * 1024n * 1024n, aiDraftCreditsUsed: 9 },
    now,
  );
  assert.deepEqual(snapshot.overLimit.sort(), ["AI_CREDITS", "PROJECTS", "SEATS", "STORAGE"]);
});

test("calculateEntitlement ends a cancelled subscription grant immediately", () => {
  const now = new Date("2026-01-15T00:00:00Z");
  const cancelledSub = {
    planCode: "TEAM",
    source: "CREEM_SUBSCRIPTION",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    subscription: { status: "CANCELLED", cancelAtPeriodEnd: false },
  };
  const snapshot = calculateEntitlement([cancelledSub], { activeProjects: 0, seats: 0, managedStorageBytes: 0n, aiDraftCreditsUsed: 0 }, now);
  assert.equal(snapshot.planCode, "STARTER");
});

test("calculateEntitlement honors past-due grace window", () => {
  const now = new Date("2026-01-15T00:00:00Z");
  const inGrace = {
    planCode: "TEAM",
    source: "CREEM_SUBSCRIPTION",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    subscription: {
      status: "PAST_DUE",
      cancelAtPeriodEnd: false,
      graceEndsAt: new Date("2026-01-20T00:00:00Z"),
    },
  };
  const snapshot = calculateEntitlement([inGrace], { activeProjects: 0, seats: 0, managedStorageBytes: 0n, aiDraftCreditsUsed: 0 }, now);
  assert.equal(snapshot.planCode, "TEAM");

  const pastGrace = {
    ...inGrace,
    subscription: { status: "PAST_DUE", cancelAtPeriodEnd: false, graceEndsAt: new Date("2026-01-10T00:00:00Z") },
  };
  const expired = calculateEntitlement([pastGrace], { activeProjects: 0, seats: 0, managedStorageBytes: 0n, aiDraftCreditsUsed: 0 }, now);
  assert.equal(expired.planCode, "STARTER");
});

test("entitlement grant validates window ordering", () => {
  const grant = () =>
    EntitlementGrant.create({
      id: "g-1",
      props: {
        tenantId: "tenant-a",
        planCode: "TEAM",
        source: "TRIAL",
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        effectiveUntil: new Date("2025-01-01T00:00:00Z"),
      },
    });
  assert.throws(grant, (error) => error instanceof DomainError && error.code === "VALIDATION_FAILED");
});

test("entitlement grant requires a subscription for CREEM_SUBSCRIPTION source", () => {
  assert.throws(
    () =>
      EntitlementGrant.create({
        id: "g-2",
        props: { tenantId: "tenant-a", planCode: "TEAM", source: "CREEM_SUBSCRIPTION", effectiveFrom: new Date() },
      }),
    (error) => error instanceof DomainError && error.code === "VALIDATION_FAILED",
  );
});

test("billing subscription validates currency and transitions", () => {
  const sub = () =>
    BillingSubscription.create({
      id: "sub-1",
      props: {
        tenantId: "tenant-a",
        provider: "CREEM",
        providerCustomerId: "cust_1",
        providerSubscriptionId: "sub_1",
        providerProductId: "prod_1",
        planCode: "TEAM",
        catalogVersion: 1,
        status: "ACTIVE",
        currency: "USD",
        unitAmountMinor: 5900,
        billingInterval: "MONTH",
        cancelAtPeriodEnd: false,
      },
    });
  const valid = sub();
  assert.equal(valid.status, "ACTIVE");

  assert.throws(
    () =>
      BillingSubscription.create({
        id: "sub-2",
        props: {
          tenantId: "tenant-a",
          provider: "CREEM",
          providerCustomerId: "",
          providerSubscriptionId: "sub_2",
          providerProductId: "prod_2",
          planCode: "TEAM",
          catalogVersion: 1,
          status: "ACTIVE",
          currency: "USD",
          unitAmountMinor: 5900,
          billingInterval: "MONTH",
          cancelAtPeriodEnd: false,
        },
      }),
    (error) => error instanceof DomainError && error.code === "VALIDATION_FAILED",
  );

  const now = new Date("2026-01-15T00:00:00Z");
  valid.markPastDue(new Date("2026-01-22T00:00:00Z"));
  assert.equal(valid.status, "PAST_DUE");
  assert.equal(valid.graceEndsAt?.toISOString(), "2026-01-22T00:00:00.000Z");
  valid.activate(now);
  assert.equal(valid.status, "ACTIVE");
  valid.scheduleCancelAtPeriodEnd(now);
  assert.equal(valid.cancelAtPeriodEnd, true);
});

test("usage counter reserve/consume/release math", () => {
  const period = new Date("2026-01-01T00:00:00Z");
  let counter = UsageCounter.create({ metric: "MANAGED_STORAGE_BYTES", periodStart: period, used: 0n, reserved: 0n });
  counter = counter.reserve(100n);
  counter = counter.consumeReserved(100n);
  assert.equal(counter.used, 100n);
  assert.equal(counter.reserved, 0n);
  assert.equal(counter.totalCommitted(), 100n);

  counter = counter.reserve(50n);
  counter = counter.release(50n);
  assert.equal(counter.reserved, 0n);
  assert.equal(counter.used, 100n);

  assert.throws(() => counter.release(5n), (error) => error instanceof DomainError && error.code === "INVARIANT_VIOLATION");
  assert.throws(() => counter.usedMinus(999n), (error) => error instanceof DomainError && error.code === "INVARIANT_VIOLATION");
});

test("plan catalog version is stable", () => {
  assert.equal(PLAN_CATALOG_VERSION, 1);
});
