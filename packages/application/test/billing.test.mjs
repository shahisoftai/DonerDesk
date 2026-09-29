import assert from "node:assert/strict";
import test from "node:test";
import { TenantId, DomainError, UsageCounter, PurchasedCreditPack } from "@donordesk/domain";
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

test("ENTITLEMENT_ENFORCEMENT=report lets an over-limit create through and logs a would-block event", async () => {
  const prior = process.env.ENTITLEMENT_ENFORCEMENT;
  process.env.ENTITLEMENT_ENFORCEMENT = "report";
  try {
    const projects = [{ id: "p-1", tenantId: "tenant-a", status: "DRAFT", title: "Existing" }];
    const audited = [];
    const entitlements = makeEntitlementService([starterGrant()], [], new Map(), projects, []);
    const handler = new CreateProjectHandler(
      fakeIds("p"),
      { listByTenant: async () => ({ ok: true, value: projects }), create: async (p) => { projects.push(p); return { ok: true, value: p }; } },
      { create: async (s) => ({ ok: true, value: s }) },
      { create: async (p) => ({ ok: true, value: p }) },
      { findByTenant: async () => ({ ok: true, value: null }) },
      { resolve: async () => ({ ok: true, value: { provider: "LOCAL" } }) },
      { publish: async () => undefined },
      { record: async (e) => { audited.push(e); return { ok: true, value: undefined }; } },
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
    assert.equal(audited.some((e) => e.eventType === "entitlement.limit_would_block"), true);
  } finally {
    if (prior === undefined) delete process.env.ENTITLEMENT_ENFORCEMENT;
    else process.env.ENTITLEMENT_ENFORCEMENT = prior;
  }
});

test("ENTITLEMENT_ENFORCEMENT=off lets an over-limit create through with no audit event", async () => {
  const prior = process.env.ENTITLEMENT_ENFORCEMENT;
  process.env.ENTITLEMENT_ENFORCEMENT = "off";
  try {
    const projects = [{ id: "p-1", tenantId: "tenant-a", status: "DRAFT", title: "Existing" }];
    const audited = [];
    const entitlements = makeEntitlementService([starterGrant()], [], new Map(), projects, []);
    const handler = new CreateProjectHandler(
      fakeIds("p"),
      { listByTenant: async () => ({ ok: true, value: projects }), create: async (p) => { projects.push(p); return { ok: true, value: p }; } },
      { create: async (s) => ({ ok: true, value: s }) },
      { create: async (p) => ({ ok: true, value: p }) },
      { findByTenant: async () => ({ ok: true, value: null }) },
      { resolve: async () => ({ ok: true, value: { provider: "LOCAL" } }) },
      { publish: async () => undefined },
      { record: async (e) => { audited.push(e); return { ok: true, value: undefined }; } },
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
    assert.equal(audited.some((e) => e.eventType === "entitlement.limit_would_block"), false);
  } finally {
    if (prior === undefined) delete process.env.ENTITLEMENT_ENFORCEMENT;
    else process.env.ENTITLEMENT_ENFORCEMENT = prior;
  }
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
  const users = [{ id: "u-1", tenantId: "tenant-a", status: "ACTIVE", role: "ADMIN", email: "a@example.com" }];
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
  const result = await handler.handle(context(), { email: "b@example.com", role: "FIELD_OFFICER" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PLAN_LIMIT_REACHED");
  assert.equal(result.error.details?.resource, "SEATS");
});

test("invite-user allows a VIEWER under the Starter seat limit even when full seats are exhausted", async () => {
  const users = [{ id: "u-1", tenantId: "tenant-a", status: "ACTIVE", role: "ADMIN", email: "a@example.com" }];
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
  const result = await handler.handle(context(), { email: "viewer@example.com", role: "VIEWER" });
  assert.equal(result.ok, true);
});

test("invite-user enforces the Starter viewerSeats limit independently of full seats", async () => {
  const users = [
    { id: "u-1", tenantId: "tenant-a", status: "ACTIVE", role: "ADMIN", email: "a@example.com" },
    { id: "u-2", tenantId: "tenant-a", status: "ACTIVE", role: "VIEWER", email: "v1@example.com" },
    { id: "u-3", tenantId: "tenant-a", status: "ACTIVE", role: "VIEWER", email: "v2@example.com" },
  ];
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
  const result = await handler.handle(context(), { email: "v3@example.com", role: "VIEWER" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PLAN_LIMIT_REACHED");
  assert.equal(result.error.details?.resource, "VIEWERS");
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

function fakeTrialIdentities(usedFingerprints = new Set()) {
  const created = [];
  return {
    created,
    existsByEmailFingerprint: async (fp) => ({ ok: true, value: usedFingerprints.has(fp) }),
    create: async (input) => { created.push(input); usedFingerprints.add(input.emailFingerprint); return { ok: true, value: { id: input.id } }; },
  };
}

test("provision-tenant grants a 14-day local TRIAL alongside the permanent STARTER base grant", async () => {
  const grants = [];
  const trialIdentities = fakeTrialIdentities();
  const handler = new ProvisionTenantHandler(
    fakeIds(),
    { create: async (o) => ({ ok: true, value: o }) },
    { create: async (u) => { u.activate(); return { ok: true, value: u }; } },
    { create: async (g) => { grants.push(g); return { ok: true, value: g }; } },
    { hashPassword: async (p) => `hash:${p}` },
    { publish: async () => undefined },
    fakeAudit(),
    fakeClock(),
    trialIdentities,
    true,
  );
  const result = await handler.handle({
    name: "Alice",
    email: "alice@ngo.org",
    passwordHash: "hash",
    verifiedEmail: "alice@ngo.org",
    requestedPlan: "TEAM",
    startTrial: true,
    organization: { name: "NGO", organizationType: "LOCAL_NGO", country: "US", primarySector: "HEALTH" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.trialGranted, true);
  assert.equal(result.value.plan, "TEAM");
  assert.equal(grants.length, 2);
  assert.equal(grants[0].props.source, "DEFAULT");
  const trial = grants[1];
  assert.equal(trial.props.source, "TRIAL");
  assert.equal(trial.props.planCode, "TEAM");
  assert.equal(trial.props.effectiveUntil.getTime() - trial.props.effectiveFrom.getTime(), 14 * 24 * 60 * 60 * 1000);
  assert.equal(trialIdentities.created.length, 1);
});

test("provision-tenant blocks a repeat trial for the same email fingerprint (abuse resistance)", async () => {
  const grants = [];
  const trialIdentities = fakeTrialIdentities();
  const handler = new ProvisionTenantHandler(
    fakeIds(),
    { create: async (o) => ({ ok: true, value: o }) },
    { create: async (u) => { u.activate(); return { ok: true, value: u }; } },
    { create: async (g) => { grants.push(g); return { ok: true, value: g }; } },
    { hashPassword: async (p) => `hash:${p}` },
    { publish: async () => undefined },
    fakeAudit(),
    fakeClock(),
    trialIdentities,
    true,
  );
  const input = {
    name: "Bob",
    email: "repeat@ngo.org",
    passwordHash: "hash",
    verifiedEmail: "repeat@ngo.org",
    requestedPlan: "GROWTH",
    startTrial: true,
    organization: { name: "NGO2", organizationType: "LOCAL_NGO", country: "US", primarySector: "HEALTH" },
  };
  const first = await handler.handle(input);
  assert.equal(first.value.trialGranted, true);

  const second = await handler.handle(input);
  assert.equal(second.ok, true);
  assert.equal(second.value.trialGranted, false);
  assert.equal(second.value.plan, "STARTER");
  // Only the two STARTER base grants and the one trial grant from the first call exist.
  assert.equal(grants.filter((g) => g.props.source === "TRIAL").length, 1);
});

test("provision-tenant never grants a trial for STARTER or ENTERPRISE (not trial-eligible)", async () => {  const grants = [];
  const trialIdentities = fakeTrialIdentities();
  const handler = new ProvisionTenantHandler(
    fakeIds(),
    { create: async (o) => ({ ok: true, value: o }) },
    { create: async (u) => { u.activate(); return { ok: true, value: u }; } },
    { create: async (g) => { grants.push(g); return { ok: true, value: g }; } },
    { hashPassword: async (p) => `hash:${p}` },
    { publish: async () => undefined },
    fakeAudit(),
    fakeClock(),
    trialIdentities,
    true,
  );
  const result = await handler.handle({
    name: "Carol",
    email: "carol@ngo.org",
    passwordHash: "hash",
    verifiedEmail: "carol@ngo.org",
    requestedPlan: "STARTER",
    startTrial: true,
    organization: { name: "NGO3", organizationType: "LOCAL_NGO", country: "US", primarySector: "HEALTH" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.trialGranted, false);
  assert.equal(grants.length, 1);
  assert.equal(trialIdentities.created.length, 0);
});

test("provision-tenant honors the server-side trials kill switch (no grant even with startTrial)", async () => {
  const grants = [];
  const trialIdentities = fakeTrialIdentities();
  const handler = new ProvisionTenantHandler(
    fakeIds(),
    { create: async (o) => ({ ok: true, value: o }) },
    { create: async (u) => { u.activate(); return { ok: true, value: u }; } },
    { create: async (g) => { grants.push(g); return { ok: true, value: g }; } },
    { hashPassword: async (p) => `hash:${p}` },
    { publish: async () => undefined },
    fakeAudit(),
    fakeClock(),
    trialIdentities,
    false,
  );
  const result = await handler.handle({
    name: "Dave",
    email: "dave@ngo.org",
    passwordHash: "hash",
    verifiedEmail: "dave@ngo.org",
    requestedPlan: "TEAM",
    startTrial: true,
    organization: { name: "NGO4", organizationType: "LOCAL_NGO", country: "US", primarySector: "HEALTH" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.trialGranted, false);
  assert.equal(result.value.plan, "STARTER");
  // Only the permanent STARTER base grant exists; the flag-gated request is
  // visible in the audit trail (trialDisabledByFlag) for ops.
  assert.equal(grants.length, 1);
  assert.equal(grants[0].props.source, "DEFAULT");
  assert.equal(trialIdentities.created.length, 0);
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
    endGrant: async () => ({ ok: true, value: undefined }),
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

// ---- BillingSubscriptionSynchronizer grant lifecycle (renewal / plan change / packs) ----

function providerSub(overrides = {}) {
  return {
    providerSubscriptionId: "sub_provider_1",
    providerCustomerId: "cust_1",
    providerProductId: "prod_team_monthly",
    planCode: "TEAM",
    status: "ACTIVE",
    currency: "USD",
    unitAmountMinor: 12900,
    billingInterval: "MONTH",
    currentPeriodStart: new Date("2026-01-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-02-01T00:00:00Z"),
    cancelAtPeriodEnd: false,
    providerUpdatedAt: new Date("2026-01-15T00:00:00Z"),
    ...overrides,
  };
}

function synchronizerFakes() {
  const storedSubscription = { value: null };
  const grantsRepo = {
    created: [],
    listByTenant: async () => ({ ok: true, value: grantsRepo.created }),
    create: async (g) => { grantsRepo.created.push(g); return { ok: true, value: g }; },
    // Mirrors the Prisma impl: ends the open window in place on the stored row.
    endGrant: async (grantId, at) => {
      const grant = grantsRepo.created.find((g) => g.id === grantId);
      if (grant && (grant.effectiveUntil === undefined || grant.effectiveUntil > at)) grant.props.effectiveUntil = at;
      return { ok: true, value: undefined };
    },
    listEffectiveByTenant: async () => ({ ok: true, value: grantsRepo.created }),
    listExpiredTrialGrants: async () => ({ ok: true, value: [] }),
  };
  const subscriptionsRepo = {
    findByProviderSubscriptionId: async () => ({ ok: true, value: storedSubscription.value }),
    create: async (s) => { storedSubscription.value = s; return { ok: true, value: s }; },
    update: async (s) => ({ ok: true, value: s }),
    findAccessGrantingByTenant: async () => ({ ok: true, value: storedSubscription.value }),
    listReconcileCandidates: async () => ({ ok: true, value: [] }),
  };
  return { grantsRepo, subscriptionsRepo, storedSubscription };
}

test("synchronizer grants exactly one covering window per period (renewal creates the next window)", async () => {
  const clockNow = { t: new Date("2026-01-15T00:00:00Z").getTime() };
  const clock = { now: () => new Date(clockNow.t) };
  const { grantsRepo, subscriptionsRepo } = synchronizerFakes();
  const sync = new BillingSubscriptionSynchronizer({}, subscriptionsRepo, grantsRepo, fakeIds("g"), fakeAudit(), clock);

  const first = await sync.sync(providerSub(), "subscription.paid", "tenant-a");
  assert.equal(first.ok, true);
  assert.equal(grantsRepo.created.length, 1);
  assert.equal(grantsRepo.created[0].planCode, "TEAM");
  assert.equal(grantsRepo.created[0].effectiveUntil.toISOString(), "2026-02-01T00:00:00.000Z");

  // Idempotent re-sync inside the same period: no duplicate grant.
  const again = await sync.sync(providerSub(), "reconcile.daily", "tenant-a");
  assert.equal(again.ok, true);
  assert.equal(grantsRepo.created.length, 1);

  // Renewal: the provider advances the period; the old window has expired by
  // the sync date, and a fresh grant covering the new period must be created
  // (before the lifecycle fix, the paying tenant silently fell back to STARTER).
  clockNow.t = new Date("2026-02-15T00:00:00Z").getTime();
  const renewed = await sync.sync(providerSub({
    currentPeriodStart: new Date("2026-02-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-03-01T00:00:00Z"),
    providerUpdatedAt: new Date("2026-02-01T00:00:00Z"),
  }), "subscription.paid", "tenant-a");
  assert.equal(renewed.ok, true);
  assert.equal(grantsRepo.created.length, 2);
  const effective = grantsRepo.created.filter((g) => g.isEffectiveAt(clock.now()));
  assert.equal(effective.length, 1);
  assert.equal(effective[0].planCode, "TEAM");
  assert.equal(effective[0].effectiveUntil.toISOString(), "2026-03-01T00:00:00.000Z");
});

test("synchronizer re-provisions the grant on a mid-cycle plan change (TEAM -> GROWTH)", async () => {
  const clockNow = { t: new Date("2026-01-20T00:00:00Z").getTime() };
  const clock = { now: () => new Date(clockNow.t) };
  const { grantsRepo, subscriptionsRepo } = synchronizerFakes();
  const sync = new BillingSubscriptionSynchronizer({}, subscriptionsRepo, grantsRepo, fakeIds("g"), fakeAudit(), clock);

  const first = await sync.sync(providerSub(), "subscription.paid", "tenant-a");
  assert.equal(first.ok, true);
  assert.equal(grantsRepo.created.length, 1);

  // Mid-cycle upgrade a few seconds later (still inside the same period).
  clockNow.t = new Date("2026-01-20T00:00:05Z").getTime();
  const upgraded = await sync.sync(providerSub({
    planCode: "GROWTH",
    providerProductId: "prod_growth_monthly",
    unitAmountMinor: 29900,
    providerUpdatedAt: new Date("2026-01-20T00:00:05Z"),
  }), "subscription.updated", "tenant-a");
  assert.equal(upgraded.ok, true);
  const effective = grantsRepo.created.filter((g) => g.isEffectiveAt(clock.now()));
  assert.equal(effective.length, 1);
  assert.equal(effective[0].planCode, "GROWTH");
  // The stale TEAM grant's window is genuinely ended in place (append-only
  // history preserved), so it can never resurface as an effective grant.
  const staleTeam = grantsRepo.created.find((g) => g.planCode === "TEAM");
  assert.ok(staleTeam, "expected the original TEAM grant row");
  assert.equal(staleTeam.effectiveUntil.getTime(), clock.now().getTime());
});

test("synchronizer suspends standing-balance packs on downgrade and reactivates them on re-subscribe", async () => {
  const clockNow = { t: new Date("2026-01-20T00:00:00Z").getTime() };
  const clock = { now: () => new Date(clockNow.t) };
  const { grantsRepo, subscriptionsRepo } = synchronizerFakes();
  const events = [];
  const audit = { record: async (e) => { events.push(e.eventType); return { ok: true, value: undefined }; } };
  const standing = PurchasedCreditPack.create({
    id: "pack-standing",
    props: {
      tenantId: "tenant-a",
      credits: 100,
      source: "GROWTH_STANDING_BALANCE",
      providerOrderId: "order_1",
      purchasedAt: new Date("2026-01-10T00:00:00Z"),
    },
  });
  const topup = PurchasedCreditPack.create({
    id: "pack-topup",
    props: {
      tenantId: "tenant-a",
      credits: 50,
      source: "TOPUP",
      providerOrderId: "order_2",
      purchasedAt: new Date("2026-01-11T00:00:00Z"),
    },
  });
  const packsRepo = {
    listByTenant: async () => ({ ok: true, value: [standing, topup] }),
    update: async (p) => ({ ok: true, value: p }),
  };
  const sync = new BillingSubscriptionSynchronizer({}, subscriptionsRepo, grantsRepo, fakeIds("g"), audit, clock, packsRepo);

  // First sync establishes the GROWTH subscription.
  const first = await sync.sync(providerSub({ planCode: "GROWTH" }), "subscription.paid", "tenant-a");
  assert.equal(first.ok, true);
  assert.equal(standing.status, "ACTIVE");
  assert.equal(topup.status, "ACTIVE");

  // Downgrade to TEAM: standing balance suspends, the TOPUP pack survives.
  const downgraded = await sync.sync(providerSub({ planCode: "TEAM" }), "subscription.updated", "tenant-a");
  assert.equal(downgraded.ok, true);
  assert.equal(standing.status, "SUSPENDED");
  assert.equal(topup.status, "ACTIVE");
  assert.ok(events.includes("billing.credits.standing_balance_suspended"));

  // Re-subscribe to GROWTH: the paid standing balance comes back.
  const resubscribed = await sync.sync(providerSub({ planCode: "GROWTH" }), "subscription.updated", "tenant-a");
  assert.equal(resubscribed.ok, true);
  assert.equal(standing.status, "ACTIVE");
  assert.ok(events.includes("billing.credits.standing_balance_reactivated"));
});
