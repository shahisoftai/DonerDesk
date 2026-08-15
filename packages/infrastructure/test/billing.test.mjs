import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { StubBillingProvider, createBillingProvider } from "../dist/billing/index.js";

function signedWebhookBody(secret, overrides = {}) {
  const body = {
    id: "evt_1",
    eventType: "subscription.paid",
    created_at: 1728734327355,
    object: {
      id: "sub_6pC2lNB6joCRQIZ1aMrTpi",
      product: { id: "prod-team-monthly", price: 5900, currency: "USD", billing_period: "every-month" },
      customer: { id: "cust_1", email: "org@example.com" },
      status: "active",
      current_period_start_date: "2026-01-01T00:00:00.000Z",
      current_period_end_date: "2026-02-01T00:00:00.000Z",
      updated_at: "2026-01-15T00:00:00.000Z",
      ...(overrides.object ?? {}),
    },
    ...(overrides.top ?? {}),
  };
  const raw = Buffer.from(JSON.stringify(body), "utf8");
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  return { raw, signature, body };
}

test("stub provider creates a checkout and portal URL", async () => {
  const provider = new StubBillingProvider("secret");
  const checkout = await provider.createCheckout({
    tenantId: "tenant-a",
    requestId: "req-1",
    plan: "TEAM",
    interval: "MONTH",
    customerEmail: "org@example.com",
    successUrl: "https://app.example.com/settings/billing",
  });
  assert.equal(checkout.ok, true);
  assert.ok(checkout.value.url.includes("stub"));
  const portal = await provider.createCustomerPortal({ providerCustomerId: "cust_1" });
  assert.equal(portal.ok, true);
  assert.ok(portal.value.url.includes("stub"));
});

test("stub provider verifies webhook signatures and parses subscriptions", async () => {
  const provider = new StubBillingProvider("secret");
  const { raw, signature, body } = signedWebhookBody("secret");
  const parsed = provider.verifyAndParseWebhook(raw, signature);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.eventId, "evt_1");
  assert.equal(parsed.value.eventType, "subscription.paid");
  assert.equal(parsed.value.subscription.planCode, "TEAM");
  assert.equal(parsed.value.subscription.status, "ACTIVE");
  assert.equal(parsed.value.subscription.billingInterval, "MONTH");
});

test("stub provider rejects bad signatures", async () => {
  const provider = new StubBillingProvider("secret");
  const { raw } = signedWebhookBody("secret");
  const parsed = provider.verifyAndParseWebhook(raw, "wrong-signature");
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, "FORBIDDEN");
});

test("stub provider parses scheduled_cancel and past_due events", async () => {
  const provider = new StubBillingProvider("secret");
  for (const [eventType, expected] of [
    ["subscription.scheduled_cancel", "ACTIVE"],
    ["subscription.past_due", "PAST_DUE"],
    ["subscription.expired", "EXPIRED"],
    ["subscription.canceled", "CANCELLED"],
  ]) {
    const { raw, signature } = signedWebhookBody("secret", { top: { eventType }, object: { status: "active" } });
    const parsed = provider.verifyAndParseWebhook(raw, signature);
    assert.equal(parsed.ok, true, eventType);
    assert.equal(parsed.value.subscription.status, expected, eventType);
  }
});

test("stub provider parses growth plan and annual interval", async () => {
  const provider = new StubBillingProvider("secret");
  const { raw, signature } = signedWebhookBody("secret", {
    object: {
      id: "sub_growth",
      product: { id: "prod-growth-annual", price: 149000, currency: "USD", billing_period: "every-year" },
      customer: { id: "cust_2" },
      status: "active",
      current_period_start_date: "2026-01-01T00:00:00.000Z",
      current_period_end_date: "2027-01-01T00:00:00.000Z",
      updated_at: "2026-01-15T00:00:00.000Z",
    },
  });
  const parsed = provider.verifyAndParseWebhook(raw, signature);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.subscription.planCode, "GROWTH");
  assert.equal(parsed.value.subscription.billingInterval, "YEAR");
  assert.equal(parsed.value.subscription.unitAmountMinor, 149000);
});

test("billing provider factory defaults to the stub", () => {
  delete process.env.BILLING_PROVIDER;
  const provider = createBillingProvider();
  assert.ok(provider instanceof StubBillingProvider);
});
