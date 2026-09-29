import { createHmac, timingSafeEqual } from "node:crypto";
import type { Result } from "@donordesk/domain";
import { DomainError, isPlanCode } from "@donordesk/domain";
import type {
  BillingProvider,
  CreateCheckoutArgs,
  CreateOneOffCheckoutArgs,
  CreditPackSku,
  ProviderBillingEvent,
  ProviderSubscription,
} from "@donordesk/application";

const STUB_STATUS_MAP: Record<string, string> = {
  "subscription.active": "ACTIVE",
  "subscription.paid": "ACTIVE",
  "subscription.trialing": "TRIALING",
  "subscription.scheduled_cancel": "ACTIVE",
  "subscription.canceled": "CANCELLED",
  "subscription.expired": "EXPIRED",
  "subscription.paused": "PAUSED",
  "subscription.past_due": "PAST_DUE",
  "subscription.unpaid": "UNPAID",
};

/**
 * Stub mirror of Creem's one-off SKUs: a stub checkout URL/product id carries
 * the SKU slug, and webhook events map back to it so the pack mint/refund
 * flows are exercisable in dev and tests without live Creem.
 */
const STUB_TOPUP_SKUS: Record<string, { sku: CreditPackSku; credits: number }> = {
  "topup-50": { sku: "TOPUP_50", credits: 50 },
  "topup-100": { sku: "TOPUP_100", credits: 100 },
  "standing-balance-100": { sku: "STANDING_BALANCE_100", credits: 100 },
};

/**
 * In-process billing provider used for development and tests. Mirrors the
 * BillingProvider contract without any network access. Webhook verification
 * accepts any non-empty signature when a webhook secret is configured for
 * tests, or a literal `test-signature` fallback.
 */
export class StubBillingProvider implements BillingProvider {
  private readonly webhookSecret: string;

  constructor(webhookSecret = "test-webhook-secret") {
    this.webhookSecret = webhookSecret;
  }

  async createCheckout(input: CreateCheckoutArgs): Promise<Result<{ checkoutId: string; url: string }, DomainError>> {
    return {
      ok: true,
      value: {
        checkoutId: `stub-checkout-${input.requestId}`,
        // `nonprofit` mirrors Creem's resolveNonprofitProduct routing so the
        // verified-discount branch is visible in dev (the stub has no separate
        // discount product; the query flag records the routing decision).
        url: `https://checkout.stub.local/${encodeURIComponent(input.plan)}?interval=${input.interval}&tenant=${input.tenantId}${input.nonprofit ? "&nonprofit=1" : ""}`,
      },
    };
  }

  async createOneOffCheckout(input: CreateOneOffCheckoutArgs): Promise<Result<{ checkoutId: string; url: string }, DomainError>> {
    return {
      ok: true,
      value: {
        checkoutId: `stub-topup-${input.requestId}`,
        url: `https://checkout.stub.local/topup/${encodeURIComponent(input.sku)}?tenant=${input.tenantId}`,
      },
    };
  }

  async createCustomerPortal(input: { providerCustomerId: string }): Promise<Result<{ url: string }, DomainError>> {
    return { ok: true, value: { url: `https://portal.stub.local/${encodeURIComponent(input.providerCustomerId)}` } };
  }

  async getSubscription(providerSubscriptionId: string): Promise<Result<ProviderSubscription, DomainError>> {
    return {
      ok: true,
      value: {
        providerSubscriptionId,
        providerCustomerId: "stub-customer",
        providerProductId: "stub-product-team-monthly",
        planCode: "TEAM",
        status: "ACTIVE",
        currency: "USD",
        unitAmountMinor: 12900,
        billingInterval: "MONTH",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        providerUpdatedAt: new Date(),
      },
    };
  }

  verifyAndParseWebhook(rawBody: Buffer, signature: string): Result<ProviderBillingEvent, DomainError> {
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    const okSig = signature === "test-signature" || signature === expected;
    if (!okSig) {
      return { ok: false, error: DomainError.forbidden("Invalid webhook signature.") };
    }
    try {
      const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
      const id = String(payload.id ?? "");
      const eventType = String(payload.eventType ?? "");
      if (!id || !eventType) return { ok: false, error: DomainError.validation("Webhook payload missing id or eventType.") };

      const object = (payload.object ?? {}) as Record<string, unknown>;
      const product = (object.product ?? {}) as Record<string, unknown>;
      const planCandidate = String(product.id ?? "");
      const planCode = planCandidate.includes("growth") ? "GROWTH" : planCandidate.includes("team") ? "TEAM" : planCandidate;

      let subscription: ProviderSubscription | undefined;
      if (isPlanCode(planCode) && planCode !== "STARTER" && planCode !== "ENTERPRISE") {
        subscription = {
          providerSubscriptionId: String(object.id ?? `stub-sub-${id}`),
          providerCustomerId: String((object.customer as { id?: string } | undefined)?.id ?? "stub-customer"),
          providerProductId: String(product.id ?? ""),
          planCode,
          status: (STUB_STATUS_MAP[eventType] as ProviderSubscription["status"]) ?? "ACTIVE",
          currency: String(product.currency ?? "USD"),
          unitAmountMinor: typeof product.price === "number" ? product.price : 5900,
          billingInterval: String(product.billing_period ?? "every-month").includes("year") ? "YEAR" : "MONTH",
          currentPeriodStart: toDate(object.current_period_start_date) ?? new Date(),
          currentPeriodEnd: toDate(object.current_period_end_date),
          trialStart: toDate(object.trial_start),
          trialEnd: toDate(object.trial_end),
          cancelAtPeriodEnd: eventType === "subscription.scheduled_cancel",
          providerUpdatedAt: toDate(object.updated_at),
        };
      }

      const metadata = extractMetadata(object);
      // Mirror the Creem adapter's order-id + one-off purchase extraction so
      // the pack mint (`checkout.completed`) and refund/dispute paths can be
      // driven from stub webhook payloads in dev/tests: give the stub product
      // an id containing one of the SKU slugs (e.g. "stub-product-topup-50").
      const productIdSlug = String(product.id ?? object.product_id ?? "");
      const topupEntry = Object.entries(STUB_TOPUP_SKUS).find(([slug]) => productIdSlug.includes(slug));
      const orderId = firstNonEmptyString(object.order_id, object.checkout_id, object.id);

      return {
        ok: true,
        value: {
          eventId: id,
          eventType,
          providerCreatedAt: toDate(payload.created_at),
          subscription,
          customerId: String((object.customer as { id?: string } | undefined)?.id ?? undefined),
          metadata: metadata ?? undefined,
          orderId,
          oneOffPurchase: topupEntry ? { sku: topupEntry[1].sku, credits: topupEntry[1].credits } : undefined,
        },
      };
    } catch (error) {
      return { ok: false, error: DomainError.validation("Webhook payload is not valid JSON.") };
    }
  }
}

function toDate(value: unknown): Date | undefined {
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value);
  return undefined;
}

function extractMetadata(object: Record<string, unknown>): Record<string, unknown> | undefined {
  const metadata = object.metadata;
  if (metadata && typeof metadata === "object") {
    const entries = Object.entries(metadata).filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean");
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }
  return undefined;
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}
