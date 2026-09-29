import assert from "node:assert/strict";
import test from "node:test";
import { PurchasedCreditPack } from "@donordesk/domain";
import { ProcessBillingWebhookHandler, BillingSubscriptionSynchronizer } from "../dist/index.js";

function fakeAudit() {
  const events = [];
  return { events, record: async (e) => { events.push(e); return { ok: true, value: undefined }; } };
}

function fakePackRepo(packs) {
  return {
    create: async (p) => { packs.push(p); return { ok: true, value: p }; },
    update: async (p) => ({ ok: true, value: p }),
    findByProviderOrderId: async (orderId) => ({ ok: true, value: packs.find((p) => p.providerOrderId === orderId) ?? null }),
    listActiveByTenant: async (tenantId) => ({ ok: true, value: packs.filter((p) => p.tenantId === tenantId && p.status === "ACTIVE") }),
    listByTenant: async (tenantId) => ({ ok: true, value: packs.filter((p) => p.tenantId === tenantId) }),
    reserve: async (id, amount) => {
      const pack = packs.find((p) => p.id === id);
      if (!pack || pack.status !== "ACTIVE" || pack.remaining < amount) {
        return { ok: false, error: { code: "CONFLICT", message: "no remaining credits" } };
      }
      pack.consume(amount);
      return { ok: true, value: pack };
    },
    release: async (id, amount) => {
      const pack = packs.find((p) => p.id === id);
      pack.release(amount);
      return { ok: true, value: pack };
    },
  };
}

function fakeWebhookDeps(event) {
  const provider = {
    verifyAndParseWebhook: () => ({ ok: true, value: event }),
    createCheckout: async () => ({ ok: true, value: { checkoutId: "c", url: "u" } }),
    createOneOffCheckout: async () => ({ ok: true, value: { checkoutId: "c", url: "u" } }),
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
  const inboxRows = new Map();
  const inbox = {
    create: async (input) => {
      if (inboxRows.has(input.providerEventId)) return { ok: false, error: { code: "CONFLICT", message: "duplicate" } };
      inboxRows.set(input.providerEventId, input);
      return { ok: true, value: { id: input.id } };
    },
    markProcessing: async () => ({ ok: true, value: undefined }),
    markProcessed: async () => ({ ok: true, value: undefined }),
    markFailed: async () => ({ ok: true, value: undefined }),
    listStaleProcessing: async () => ({ ok: true, value: [] }),
  };
  const ids = { generate: (() => { let n = 0; return () => `id-${++n}`; })() };
  const clock = { now: () => new Date("2026-01-15T00:00:00Z") };
  const synchronizer = new BillingSubscriptionSynchronizer(provider, subscriptions, grants, ids, fakeAudit(), clock);
  return { provider, subscriptions, inbox, synchronizer };
}

test("checkout.completed for a top-up SKU creates a PurchasedCreditPack", async () => {
  const packs = [];
  const audit = fakeAudit();
  const event = {
    eventId: "evt_topup_1",
    eventType: "checkout.completed",
    providerCreatedAt: new Date("2026-01-15T00:00:00Z"),
    metadata: { tenant_id: "tenant-a" },
    orderId: "order_1",
    oneOffPurchase: { sku: "TOPUP_50", credits: 50 },
  };
  const { provider, subscriptions, inbox, synchronizer } = fakeWebhookDeps(event);
  const handler = new ProcessBillingWebhookHandler(provider, subscriptions, inbox, synchronizer, fakePackRepo(packs), audit);

  const result = await handler.handle({ provider: "CREEM", rawBody: Buffer.from("{}"), signature: "sig" });
  assert.equal(result.ok, true);
  assert.equal(packs.length, 1);
  assert.equal(packs[0].tenantId, "tenant-a");
  assert.equal(packs[0].credits, 50);
  assert.equal(packs[0].status, "ACTIVE");
  assert.equal(audit.events.some((e) => e.eventType === "billing.credit_pack.purchased"), true);
});

test("a duplicate checkout.completed for the same order id is a no-op (idempotent)", async () => {
  const packs = [];
  const event = {
    eventId: "evt_topup_2",
    eventType: "checkout.completed",
    providerCreatedAt: new Date(),
    metadata: { tenant_id: "tenant-a" },
    orderId: "order_2",
    oneOffPurchase: { sku: "TOPUP_100", credits: 100 },
  };
  const packRepo = fakePackRepo(packs);
  // Simulate the order having already been recorded (e.g. inbox dedupe bypassed).
  const existing = PurchasedCreditPack.create({ id: "pre-existing", props: { tenantId: "tenant-a", credits: 100, providerOrderId: "order_2", purchasedAt: new Date() } });
  packs.push(existing);
  const { provider, subscriptions, inbox, synchronizer } = fakeWebhookDeps(event);
  const handler = new ProcessBillingWebhookHandler(provider, subscriptions, inbox, synchronizer, packRepo, fakeAudit());

  const result = await handler.handle({ provider: "CREEM", rawBody: Buffer.from("{}"), signature: "sig" });
  assert.equal(result.ok, true);
  assert.equal(packs.length, 1);
});

test("refund.created marks the matching pack REFUNDED without clawing back consumed credits", async () => {
  const pack = PurchasedCreditPack.create({ id: "pack-1", props: { tenantId: "tenant-a", credits: 50, providerOrderId: "order_3", purchasedAt: new Date() } });
  pack.consume(10);
  const packs = [pack];
  const audit = fakeAudit();
  const event = {
    eventId: "evt_refund_1",
    eventType: "refund.created",
    providerCreatedAt: new Date(),
    orderId: "order_3",
  };
  const { provider, subscriptions, inbox, synchronizer } = fakeWebhookDeps(event);
  const handler = new ProcessBillingWebhookHandler(provider, subscriptions, inbox, synchronizer, fakePackRepo(packs), audit);

  const result = await handler.handle({ provider: "CREEM", rawBody: Buffer.from("{}"), signature: "sig" });
  assert.equal(result.ok, true);
  assert.equal(pack.status, "REFUNDED");
  assert.equal(pack.used, 10); // consumed credits are never clawed back
  assert.equal(audit.events.some((e) => e.eventType === "billing.credit_pack.refunded"), true);
});

test("a refund for an order that isn't a credit pack is a no-op", async () => {
  const packs = [];
  const event = { eventId: "evt_refund_2", eventType: "refund.created", providerCreatedAt: new Date(), orderId: "order_unrelated" };
  const { provider, subscriptions, inbox, synchronizer } = fakeWebhookDeps(event);
  const handler = new ProcessBillingWebhookHandler(provider, subscriptions, inbox, synchronizer, fakePackRepo(packs), fakeAudit());

  const result = await handler.handle({ provider: "CREEM", rawBody: Buffer.from("{}"), signature: "sig" });
  assert.equal(result.ok, true);
});

test("PurchasedCreditPack domain: consume marks EXHAUSTED at capacity; release un-exhausts", () => {
  const pack = PurchasedCreditPack.create({ id: "p", props: { tenantId: "t", credits: 5, purchasedAt: new Date() } });
  pack.consume(5);
  assert.equal(pack.status, "EXHAUSTED");
  assert.equal(pack.remaining, 0);
  assert.throws(() => pack.consume(1));
  pack.release(1);
  assert.equal(pack.status, "ACTIVE");
  assert.equal(pack.remaining, 1);
});

test("PurchasedCreditPack domain: source defaults to TOPUP when not specified", () => {
  const pack = PurchasedCreditPack.create({ id: "p-default", props: { tenantId: "t", credits: 5, purchasedAt: new Date() } });
  assert.equal(pack.source, "TOPUP");
});

test("PurchasedCreditPack domain: suspendForDowngrade only applies to GROWTH_STANDING_BALANCE packs", () => {
  const topup = PurchasedCreditPack.create({ id: "p-topup", props: { tenantId: "t", credits: 5, purchasedAt: new Date(), source: "TOPUP" } });
  assert.throws(() => topup.suspendForDowngrade());

  const standing = PurchasedCreditPack.create({ id: "p-standing", props: { tenantId: "t", credits: 5, purchasedAt: new Date(), source: "GROWTH_STANDING_BALANCE" } });
  standing.suspendForDowngrade();
  assert.equal(standing.status, "SUSPENDED");
  // Idempotent: suspending again is a no-op, not an error.
  standing.suspendForDowngrade();
  assert.equal(standing.status, "SUSPENDED");
  // Suspended packs can no longer draw down.
  assert.throws(() => standing.consume(1));
});

test("checkout.completed for the standing-balance SKU creates a GROWTH_STANDING_BALANCE pack", async () => {
  const packs = [];
  const event = {
    eventId: "evt_standing_1",
    eventType: "checkout.completed",
    providerCreatedAt: new Date(),
    metadata: { tenant_id: "tenant-a" },
    orderId: "order_standing_1",
    oneOffPurchase: { sku: "STANDING_BALANCE_100", credits: 100 },
  };
  const { provider, subscriptions, inbox, synchronizer } = fakeWebhookDeps(event);
  const handler = new ProcessBillingWebhookHandler(provider, subscriptions, inbox, synchronizer, fakePackRepo(packs), fakeAudit());

  const result = await handler.handle({ provider: "CREEM", rawBody: Buffer.from("{}"), signature: "sig" });
  assert.equal(result.ok, true);
  assert.equal(packs.length, 1);
  assert.equal(packs[0].source, "GROWTH_STANDING_BALANCE");
});

test("webhook refuses to mint a 3rd active standing-balance pack for a tenant (cap enforcement)", async () => {
  const existing = [
    PurchasedCreditPack.create({ id: "sb-1", props: { tenantId: "tenant-a", credits: 100, purchasedAt: new Date(), source: "GROWTH_STANDING_BALANCE", providerOrderId: "order_a" } }),
    PurchasedCreditPack.create({ id: "sb-2", props: { tenantId: "tenant-a", credits: 100, purchasedAt: new Date(), source: "GROWTH_STANDING_BALANCE", providerOrderId: "order_b" } }),
  ];
  const packs = [...existing];
  const audit = fakeAudit();
  const event = {
    eventId: "evt_standing_cap",
    eventType: "checkout.completed",
    providerCreatedAt: new Date(),
    metadata: { tenant_id: "tenant-a" },
    orderId: "order_c",
    oneOffPurchase: { sku: "STANDING_BALANCE_100", credits: 100 },
  };
  const { provider, subscriptions, inbox, synchronizer } = fakeWebhookDeps(event);
  const handler = new ProcessBillingWebhookHandler(provider, subscriptions, inbox, synchronizer, fakePackRepo(packs), audit);

  const result = await handler.handle({ provider: "CREEM", rawBody: Buffer.from("{}"), signature: "sig" });
  assert.equal(result.ok, true);
  assert.equal(packs.length, 2, "no 3rd pack should have been minted");
  assert.equal(audit.events.some((e) => e.eventType === "billing.credits.standing_balance_capped"), true);
});

test("downgrading a subscription away from GROWTH suspends standing-balance packs but not top-up packs", async () => {
  const standing = PurchasedCreditPack.create({ id: "sb-downgrade", props: { tenantId: "tenant-a", credits: 100, purchasedAt: new Date(), source: "GROWTH_STANDING_BALANCE" } });
  const topup = PurchasedCreditPack.create({ id: "topup-survives", props: { tenantId: "tenant-a", credits: 50, purchasedAt: new Date(), source: "TOPUP" } });
  const packs = [standing, topup];
  const packRepo = fakePackRepo(packs);
  const audit = fakeAudit();

  const provider = {
    verifyAndParseWebhook: () => ({ ok: true, value: {} }),
    createCheckout: async () => ({ ok: true, value: { checkoutId: "c", url: "u" } }),
    createOneOffCheckout: async () => ({ ok: true, value: { checkoutId: "c", url: "u" } }),
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
  const ids = { generate: (() => { let n = 0; return () => `id-${++n}`; })() };
  const clock = { now: () => new Date("2026-01-15T00:00:00Z") };
  const synchronizer = new BillingSubscriptionSynchronizer(provider, subscriptions, grants, ids, audit, clock, packRepo);

  // Tenant downgrades from GROWTH to TEAM while remaining ACTIVE.
  const result = await synchronizer.sync(
    {
      providerSubscriptionId: "sub-1",
      providerProductId: "prod-team",
      planCode: "TEAM",
      status: "ACTIVE",
      currency: "USD",
      unitAmountMinor: 5900,
      billingInterval: "MONTH",
    },
    "subscription.active",
    "tenant-a",
  );
  assert.equal(result.ok, true);
  assert.equal(standing.status, "SUSPENDED");
  assert.equal(topup.status, "ACTIVE", "TOPUP packs must keep drawing down after a downgrade");
  assert.equal(audit.events.some((e) => e.eventType === "billing.credits.standing_balance_suspended"), true);
});
