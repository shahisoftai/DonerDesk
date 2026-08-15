import { createHmac, timingSafeEqual } from "node:crypto";
import type { Result } from "@donordesk/domain";
import { DomainError, isPlanCode, type BillingInterval } from "@donordesk/domain";
import type {
  BillingProvider,
  CreateCheckoutArgs,
  ProviderBillingEvent,
  ProviderSubscription,
} from "@donordesk/application";

const CREEM_PRODUCT_ENV: Record<"TEAM" | "GROWTH", Record<BillingInterval, string>> = {
  TEAM: {
    MONTH: "CREEM_PRODUCT_TEAM_MONTHLY",
    YEAR: "CREEM_PRODUCT_TEAM_ANNUAL",
  },
  GROWTH: {
    MONTH: "CREEM_PRODUCT_GROWTH_MONTHLY",
    YEAR: "CREEM_PRODUCT_GROWTH_ANNUAL",
  },
};

export interface CreemBillingProviderOptions {
  apiKey?: string;
  webhookSecret?: string;
  testMode?: boolean;
  products?: Partial<Record<"TEAM" | "GROWTH", Partial<Record<BillingInterval, string>>>>;
}

const EVENT_TO_STATUS: Record<string, string> = {
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
 * Creem (Merchant of Record) adapter. Implements the BillingProvider port;
 * all provider-specific HTTP concerns live here. In test mode the test API
 * host is used. Webhook signatures are verified with HMAC-SHA256 against the
 * exact raw bytes, comparing in constant time.
 */
export class CreemBillingProvider implements BillingProvider {
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly testMode: boolean;
  private readonly products: Partial<Record<"TEAM" | "GROWTH", Partial<Record<BillingInterval, string>>>>;

  constructor(options: CreemBillingProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.CREEM_API_KEY ?? "";
    this.webhookSecret = options.webhookSecret ?? process.env.CREEM_WEBHOOK_SECRET ?? "";
    this.testMode = options.testMode ?? process.env.CREEM_TEST_MODE !== "false";
    this.products = options.products ?? {};
    if (!this.apiKey) throw new Error("CREEM_API_KEY is required for the Creem billing provider");
    if (!this.webhookSecret) throw new Error("CREEM_WEBHOOK_SECRET is required for the Creem billing provider");
  }

  private get baseUrl(): string {
    return this.testMode ? "https://test-api.creem.io" : "https://api.creem.io";
  }

  async createCheckout(input: CreateCheckoutArgs): Promise<Result<{ checkoutId: string; url: string }, DomainError>> {
    const productId = this.resolveProduct(input.plan, input.interval);
    if (!productId) {
      return { ok: false, error: DomainError.billingStateInvalid("No product configured for the requested plan/interval.") };
    }
    try {
      const response = await fetch(`${this.baseUrl}/v1/checkouts`, {
        method: "POST",
        headers: { "x-api-key": this.apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          request_id: input.requestId,
          success_url: input.successUrl,
          customer: { email: input.customerEmail },
          metadata: { tenant_id: input.tenantId },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        return { ok: false, error: DomainError.billingProviderUnavailable(`Creem checkout failed (HTTP ${response.status}).`) };
      }
      const data = (await response.json()) as { id?: string; checkout_url?: string };
      if (!data.id || !data.checkout_url) {
        return { ok: false, error: DomainError.billingProviderUnavailable("Creem checkout returned an unexpected payload.") };
      }
      return { ok: true, value: { checkoutId: data.id, url: data.checkout_url } };
    } catch (error) {
      return { ok: false, error: DomainError.billingProviderUnavailable("Creem checkout could not be reached.", { cause: String(error) }) };
    }
  }

  async createCustomerPortal(input: { providerCustomerId: string }): Promise<Result<{ url: string }, DomainError>> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/customers/billing`, {
        method: "POST",
        headers: { "x-api-key": this.apiKey, "content-type": "application/json" },
        body: JSON.stringify({ customer_id: input.providerCustomerId }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        return { ok: false, error: DomainError.billingProviderUnavailable(`Creem portal failed (HTTP ${response.status}).`) };
      }
      const data = (await response.json()) as { customer_portal_link?: string };
      if (!data.customer_portal_link) {
        return { ok: false, error: DomainError.billingProviderUnavailable("Creem portal returned an unexpected payload.") };
      }
      return { ok: true, value: { url: data.customer_portal_link } };
    } catch (error) {
      return { ok: false, error: DomainError.billingProviderUnavailable("Creem portal could not be reached.", { cause: String(error) }) };
    }
  }

  async getSubscription(providerSubscriptionId: string): Promise<Result<ProviderSubscription, DomainError>> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/subscriptions/${providerSubscriptionId}`, {
        headers: { "x-api-key": this.apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        return { ok: false, error: DomainError.billingProviderUnavailable(`Creem subscription lookup failed (HTTP ${response.status}).`) };
      }
      const data = (await response.json()) as Record<string, unknown>;
      const mapped = mapSubscriptionObject(data);
      if (!mapped) {
        return { ok: false, error: DomainError.billingProviderUnavailable("Creem subscription returned an unexpected payload.") };
      }
      return { ok: true, value: mapped };
    } catch (error) {
      return { ok: false, error: DomainError.billingProviderUnavailable("Creem subscription could not be reached.", { cause: String(error) }) };
    }
  }

  verifyAndParseWebhook(rawBody: Buffer, signature: string): Result<ProviderBillingEvent, DomainError> {
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature ?? "", "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: DomainError.forbidden("Invalid webhook signature.") };
    }
    try {
      const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
      const id = String(payload.id ?? "");
      const eventType = String(payload.eventType ?? "");
      if (!id || !eventType) {
        return { ok: false, error: DomainError.validation("Webhook payload missing id or eventType.") };
      }
      const createdRaw = payload.created_at;
      const createdAt = typeof createdRaw === "number" ? new Date(createdRaw) : typeof createdRaw === "string" ? new Date(createdRaw) : undefined;
      const object = (payload.object ?? {}) as Record<string, unknown>;
      const subscription = mapSubscriptionObject(object);

      return {
        ok: true,
        value: {
          eventId: id,
          eventType,
          providerCreatedAt: createdAt,
          subscription: subscription ?? undefined,
          customerId: extractCustomerId(object),
        },
      };
    } catch (error) {
      return { ok: false, error: DomainError.validation("Webhook payload is not valid JSON.") };
    }
  }

  private resolveProduct(plan: "TEAM" | "GROWTH", interval: BillingInterval): string | undefined {
    const configured = this.products[plan]?.[interval];
    if (configured) return configured;
    const envKey = CREEM_PRODUCT_ENV[plan][interval];
    return process.env[envKey];
  }
}

function extractCustomerId(object: Record<string, unknown>): string | undefined {
  const customer = object.customer;
  if (customer && typeof customer === "object" && typeof (customer as { id?: unknown }).id === "string") {
    return (customer as { id: string }).id;
  }
  if (typeof object.customer === "string") return object.customer;
  return undefined;
}

function mapSubscriptionObject(obj: Record<string, unknown>): ProviderSubscription | undefined {
  const id = obj.id;
  const product = (obj.product ?? {}) as Record<string, unknown>;
  const statusRaw = String(obj.status ?? "");
  const planCode = mapProductToPlan(String(product.id ?? ""));
  if (typeof id !== "string" || !isPlanCode(planCode)) return undefined;

  return {
    providerSubscriptionId: id,
    providerCustomerId: extractCustomerId(obj),
    providerProductId: String(product.id ?? ""),
    planCode,
    status: mapStatus(statusRaw),
    currency: String(product.currency ?? "USD"),
    unitAmountMinor: typeof product.price === "number" ? product.price : 0,
    billingInterval: (String(product.billing_period ?? "")).includes("year") ? "YEAR" : "MONTH",
    currentPeriodStart: toDate(obj.current_period_start_date),
    currentPeriodEnd: toDate(obj.current_period_end_date),
    trialStart: toDate(obj.trial_start),
    trialEnd: toDate(obj.trial_end),
    cancelAtPeriodEnd: statusRaw === "scheduled_cancel",
    graceEndsAt: undefined,
    providerUpdatedAt: toDate(obj.updated_at),
  };
}

function mapStatus(raw: string): import("@donordesk/domain").BillingSubscriptionStatus {
  switch (raw) {
    case "active":
    case "paid":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "unpaid":
      return "UNPAID";
    case "scheduled_cancel":
      return "ACTIVE";
    case "canceled":
      return "CANCELLED";
    case "expired":
      return "EXPIRED";
    case "paused":
      return "PAUSED";
    default:
      return "ACTIVE";
  }
}

function mapProductToPlan(productId: string): string {
  // Allowlisted server-side mapping in resolveProduct; here we recover the
  // plan from the provider product id when it was configured with a known
  // suffix. Unknown products fall back to STARTER-safe handling by returning
  // the raw id (rejected by isPlanCode in the caller).
  if (productId.includes("team")) return "TEAM";
  if (productId.includes("growth")) return "GROWTH";
  return productId;
}

function toDate(value: unknown): Date | undefined {
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value);
  return undefined;
}

export { EVENT_TO_STATUS };
