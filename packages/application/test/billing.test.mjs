import assert from "node:assert/strict";
import test from "node:test";
import { TenantId, DomainError, UsageCounter } from "@donordesk/domain";
import {
  CreateProjectHandler,
  InviteUserHandler,
  ProvisionTenantHandler,
  CreateCheckoutHandler,
  GetBillingSummaryHandler,
  ProcessBillingWebhookHandler,
  BillingSubscriptionSynchronizer,
  EntitlementService,
} from "../dist/index.js";

function fakeAudit() {
  return { record: async () => ({ ok: true, value: undefined }) };
}

function fakeIds(prefix = "id") {
  let n = 0;
  return { generate: () => `${prefix}-${++n}` };
}

function fakeClock() {
  const now = new Date("2026-01-15T00:00:00Z");
  return { now: () => new Date(now.getTime()) };
}

function context(overrides = {}) {
  return {
    tenant: { tenantId: TenantId.create("tenant-a"), userId: "user-a", role: "ADMIN" },
    requestId: "req-1",
    ...overrides,
  };
}

function makeEntitlementService(grants, subscriptions, usageCounters, projects, users) {
  return new EntitlementService(
    {
      create: async (g) => { grants.push(g); return { ok: true, value: g }; },
      listByTenant: async () => ({ ok: true, value: grants }),
      listEffectiveByTenant: async (tenantId, now) => ({
        ok: true,
        value: grants.filter((g) => g.isEffectiveAt(now)),
      }),
      listExpiredTrialGrants: async () => ({ ok: true, value: [] }),
    },
    {
      create: async (s) => { subscriptions.push(s); return { ok: true, value: s }; },
      update: async (s) => ({ ok: true, value: s }),
      findByProviderSubscriptionId: async (id) => ({
        ok: true,
        value: subscriptions.find((s) => s.providerSubscriptionId === id) ?? null,
      }),
      findAccessGrantingByTenant: async (tenantId) => ({
        ok: true,
        value: subscriptions.find((s) => s.tenantId === tenantId) ?? null,
      }),
    },
    {
      get: async (tenantId, metric, periodStart) => {
        const key = `${tenantId}:${metric}`;
        let counter = usageCounters.get(key);
        if (!counter) {
          counter = UsageCounter.create({ metric, periodStart, used: 0n, reserved: 0n });
          usageCounters.set(key, counter);
        }
        return { ok: true, value: counter };
      },
      add: async (tenantId, metric, periodStart, delta) => {
        const key = `${tenantId}:${metric}`;
        let counter = usageCounters.get(key);
        if (!counter) {
          counter = UsageCounter.create({ metric, periodStart, used: 0n, reserved: 0n });
          usageCounters.set(key, counter);
        }
        counter = counter.reserve(delta < 0n ? 0n : delta);
        if (delta < 0n) counter = counter.release(-delta);
        usageCounters.set(key, counter);
        return { ok: true, value: counter };
      },
    },
    { listByTenant: async () => ({ ok: true, value: projects }) },
    { listByTenant: async () => ({ ok: true, value: users }) },
  );
}

function starterGrant() {
  return {
    id: "g-base",
    tenantId: "tenant-a",
    planCode: "STARTER",
    source: "DEFAULT",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveUntil: undefined,
    billingSubscriptionId: undefined,
    overrideLimitsJson: null,
    reason: "test",
    createdById: "user-a",
    isEffectiveAt: () => true,
  };
}

function trialGrant() {
  return {
    id: "g-trial",
    tenantId: "tenant-a",
    planCode: "GROWTH",
    source: "TRIAL",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveUntil: new Date("2100-01-29T00:00:00Z"),
    billingSubscriptionId: undefined,
    overrideLimitsJson: null,
    reason: "test",
    createdById: "user-a",
    isEffectiveAt: (now) => now.getTime() >= new Date("2026-01-01T00:00:00Z").getTime() && now.getTime() < new Date("2100-01-29T00:00:00Z").getTime(),
  };
}

test("create-project enforces the Starter project limit", async () => {
  const projects = [{ id: "p-1", tenantId: "tenant-a", status: "DRAFT", title: "Existing" }];
  const entitlements = makeEntitlementService([starterGrant()], [], new Map(), projects, []);
  const handler = new CreateProjectHandler(
    fakeIds("p"),
    { listByTenant: async () => ({ ok: true, value: projects }), create: async (p) => ({ ok: true, value: p }) },
    { create: async (s) => ({ ok: true, value: s }) },
    { create: async (p) => ({ ok: true, value: p }) },
    { findByTenant: async () => ({ ok: true, value: null }) },
    { resolve: async () => ({ ok: true, value: { provider: "LOCAL" } }) },
    { publish: async () => undefined },
    fakeAudit(),
    entitlements,
  );
  const result = await handler.handle(context(), {
    title: "Second project",
    projectCode: "PRJ-2",
    donorName: "Donor",
    implementingOrganization: "Org",
    country: "US",
    sector: "HEALTH",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    reportingFrequency: "QUARTERLY",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PLAN_LIMIT_REACHED");
  assert.equal(result.error.details?.resource, "PROJECTS");
});

test("create-project allows projects under the limit", async () => {
  const projects = [];
  const entitlements = makeEntitlementService([starterGrant()], [], new Map(), projects, []);
  const handler = new CreateProjectHandler(
    fakeIds("p"),
    { listByTenant: async () => ({ ok: true, value: projects }), create: async (p) => { projects.push(p); return { ok: true, value: p }; } },
    { create: async (s) => ({ ok: true, value: s }) },
    { create: async (p) => ({ ok: true, value: p }) },
    { findByTenant: async () => ({ ok: true, value: null }) },
    { resolve: async () => ({ ok: true, value: { provider: "LOCAL" } }) },
    { publish: async () => undefined },
    fakeAudit(),
    entitlements,
  );
  const result = await handler.handle(context(), {
    title: "First project",
    projectCode: "PRJ-1",
    donorName: "Donor",
    implementingOrganization: "Org",
    country: "US",
    sector: "HEALTH",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    reportingFrequency: "QUARTERLY",
  });
  assert.equal(result.ok, true);
});

test("trial grants increase the project capacity", async () => {
  const projects = [{ id: "p-1", tenantId: "tenant-a", status: "DRAFT", title: "Existing" }];
  const entitlements = makeEntitlementService([starterGrant(), trialGrant()], [], new Map(), projects, []);
  const handler = new CreateProjectHandler(
    fakeIds("p"),
    { listByTenant: async () => ({ ok: true, value: projects }), create: async (p) => ({ ok: true, value: p }) },
    { create: async (s) => ({ ok: true, value: s }) },
    { create: async (p) => ({ ok: true, value: p }) },
    { findByTenant: async () => ({ ok: true, value: null }) },
    { resolve: async () => ({ ok: true, value: { provider: "LOCAL" } }) },
    { publish: async () => undefined },
    fakeAudit(),
    entitlements,
  );
  const result = await handler.handle(context(), {
    title: "Second project",
    projectCode: "PRJ-2",
    donorName: "Donor",
    implementingOrganization: "Org",
    country: "US",
    sector: "HEALTH",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    reportingFrequency: "QUARTERLY",
  });
  assert.equal(result.ok, true);
});

test("invite-user enforces the Starter seat limit", async () => {
  const users = [{ id: "u-1", tenantId: "tenant-a", status: "ACTIVE", email: "a@example.com" }];
  const entitlements = makeEntitlementService([starterGrant()], [], new Map(), [], users);
  const handler = new InviteUserHandler(
    fakeIds("inv"),
    {
      findByEmail: async () => ({ ok: true, value: null }),
      listByTenant: async () => ({ ok: true, value: users }),
    },
    { create: async (i) => ({ ok: true, value: i }) },
    fakeAudit(),
    { notify: async () => undefined },
    entitlements,
  );
  const result = await handler.handle(context(), { email: "b@example.com", role: "VIEWER" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PLAN_LIMIT_REACHED");
  assert.equal(result.error.details?.resource, "SEATS");
});

test("provision-tenant always starts on the free STARTER tier", async () => {
  const grants = [];
  const handler = new ProvisionTenantHandler(
    fakeIds(),
    { create: async (o) => ({ ok: true, value: o }) },
    { create: async (u) => { u.activate(); return { ok: true, value: u }; } },
    { create: async (g) => { grants.push(g); return { ok: true, value: g }; } },
    { hashPassword: async (p) => `hash:${p}` },
    { publish: async () => undefined },
    fakeAudit(),
    fakeClock(),
  );
  const result = await handler.handle({
    name: "Alice",
    email: "alice@ngo.org",
    passwordHash: "hash",
    verifiedEmail: "alice@ngo.org",
    requestedPlan: "TEAM",
    organization: { name: "NGO", organizationType: "LOCAL_NGO", country: "US", primarySector: "HEALTH" },
  });
  assert.equal(result.ok, true);
  // Requested plans never grant free paid access: the base STARTER grant is the
  // only entitlement until a paid subscription is created.
  assert.equal(result.value.trialGranted, false);
  assert.equal(result.value.plan, "STARTER");
  assert.equal(grants.length, 1);
  assert.equal(grants[0].props.planCode, "STARTER");
  assert.equal(grants[0].props.source, "DEFAULT");
});

test("billing summary reflects current plan and usage", async () => {
  const grants = [starterGrant()];
  const seeded = new Map();
  seeded.set("tenant-a:MANAGED_STORAGE_BYTES", UsageCounter.create({
    metric: "MANAGED_STORAGE_BYTES",
    periodStart: new Date("2026-01-01T00:00:00Z"),
    used: 100n,
    reserved: 0n,
  }));
  const entitlements = makeEntitlementService(grants, [], seeded, [], []);
  const handler = new GetBillingSummaryHandler(entitlements);
  const result = await handler.handle(context());
  assert.equal(result.ok, true);
  assert.equal(result.value.plan, "STARTER");
  assert.equal(result.value.usage.managedStorageBytes.used, "100");
  assert.equal(result.value.usage.projects.limit, 1);
});

test("checkout rejects an active subscription for the same plan", async () => {
  const subscriptions = [{
    id: "sub-1",
    tenantId: "tenant-a",
    planCode: "TEAM",
    status: "ACTIVE",
    cancelAtPeriodEnd: false,
    providerSubscriptionId: "sub_provider_1",
    providerCustomerId: "cust_1",
    providerProductId: "prod_1",
  }];
  const handler = new CreateCheckoutHandler(
    { createCheckout: async () => ({ ok: true, value: { checkoutId: "c", url: "https://checkout" } }) },
    { findByTenant: async () => ({ ok: true, value: { contactEmail: "org@example.com" } }) },
    { findAccessGrantingByTenant: async () => ({ ok: true, value: subscriptions[0] }) },
    fakeIds("c"),
    fakeAudit(),
  );
  const result = await handler.handle(context(), { plan: "TEAM", interval: "MONTH" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "BILLING_STATE_INVALID");
});

test("webhook processor ignores events without a subscription (checkout.completed)", async () => {
  const provider = {
    verifyAndParseWebhook: (raw, sig) => ({ ok: true, value: { eventId: "evt_1", eventType: "checkout.completed", providerCreatedAt: new Date() } }),
    createCheckout: async () => ({ ok: true, value: { checkoutId: "c", url: "u" } }),
    createCustomerPortal: async () => ({ ok: true, value: { url: "u" } }),
    getSubscription: async () => ({ ok: true, value: undefined }),
  };
  const subscriptions = {
    findByProviderSubscriptionId: async () => ({ ok: true, value: null }),
    create: async (s) => ({ ok: true, value: s }),
    update: async (s) => ({ ok: true, value: s }),
    findAccessGrantingByTenant: async () => ({ ok: true, value: null }),
    listReconcileCandidates: async () => ({ ok: true, value: [] }),
  };
  const grants = {
    listByTenant: async () => ({ ok: true, value: [] }),
    create: async (g) => ({ ok: true, value: g }),
    listEffectiveByTenant: async () => ({ ok: true, value: [] }),
    listExpiredTrialGrants: async () => ({ ok: true, value: [] }),
  };
  const inbox = {
    create: async () => ({ ok: true, value: { id: "inbox-1" } }),
    markProcessing: async () => ({ ok: true, value: undefined }),
    markProcessed: async () => ({ ok: true, value: undefined }),
    markFailed: async () => ({ ok: true, value: undefined }),
    listStaleProcessing: async () => ({ ok: true, value: [] }),
  };
  const ids = fakeIds("evt");
  const audit = fakeAudit();
  const clock = fakeClock();
  const synchronizer = new BillingSubscriptionSynchronizer(provider, subscriptions, grants, ids, audit, clock);
  const handler = new ProcessBillingWebhookHandler(provider, subscriptions, inbox, synchronizer);
  const result = await handler.handle({ provider: "CREEM", rawBody: Buffer.from("{}"), signature: "sig" });
  assert.equal(result.ok, true);
  assert.equal(result.value.handled, true);
});

test("entitlement service resolves trial capacity for summary", async () => {
  const grants = [starterGrant(), trialGrant()];
  const entitlements = makeEntitlementService(grants, [], new Map(), [], []);
  const handler = new GetBillingSummaryHandler(entitlements);
  const result = await handler.handle(context());
  assert.equal(result.ok, true);
  assert.equal(result.value.plan, "GROWTH");
  assert.equal(result.value.isTrial, true);
  assert.equal(result.value.trialEndsAt, "2100-01-29T00:00:00.000Z");
});
