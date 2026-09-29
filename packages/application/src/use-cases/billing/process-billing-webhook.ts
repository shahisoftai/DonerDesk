import { createHash } from "node:crypto";
import type { Result } from "@donordesk/domain";
import { DomainError, MAX_ACTIVE_GROWTH_STANDING_BALANCE_PACKS, PurchasedCreditPack, TenantId } from "@donordesk/domain";
import type { PurchasedCreditPackSource } from "@donordesk/domain";
import type { BillingProvider, CreditPackSku, ProviderBillingEvent } from "../../ports/billing.js";
import type {
  IBillingSubscriptionRepository,
  IBillingEventInboxRepository,
  IPurchasedCreditPackRepository,
} from "../../ports/billing.js";
import type { IAuditLogger } from "../../ports/core.js";
import { BillingSubscriptionSynchronizer } from "../../services/billing-subscription-synchronizer.js";

const REFUND_EVENT_TYPES = new Set(["refund.created", "dispute.created"]);

/** SKUs that create a Growth-only standing-balance pack rather than a regular top-up (§4 WS-D item 5). */
const STANDING_BALANCE_SKUS = new Set<CreditPackSku>(["STANDING_BALANCE_100"]);

function packSourceForSku(sku: CreditPackSku): PurchasedCreditPackSource {
  return STANDING_BALANCE_SKUS.has(sku) ? "GROWTH_STANDING_BALANCE" : "TOPUP";
}

export interface ProcessBillingWebhookCommand {
  provider: string;
  rawBody: Buffer;
  signature: string;
}

export interface ProcessBillingWebhookResult {
  handled: boolean;
  eventId?: string;
  eventType?: string;
  inboxId?: string;
}

/**
 * Webhook ingestion + subscription lifecycle sync.
 *
 * 1. Verify and parse the raw body against the provider signature.
 * 2. Insert a durable inbox row keyed by the globally unique provider event id
 *    (dedupe: a duplicate returns 200 with no effects).
 * 3. Resolve the tenant from trusted request metadata (recorded at checkout);
 *    where absent, fall back to the locally persisted subscription mapping.
 * 4. Transactionally sync the subscription, change entitlement grants, audit,
 *    and mark the inbox row processed.
 *
 * The application owns entitlement changes; the adapter only maps provider
 * objects/events (SRP/DIP), and provider state is applied through the shared
 * BillingSubscriptionSynchronizer (DRY).
 */
export class ProcessBillingWebhookHandler {
  constructor(
    private readonly billing: BillingProvider,
    private readonly subscriptions: IBillingSubscriptionRepository,
    private readonly inbox: IBillingEventInboxRepository,
    private readonly synchronizer: BillingSubscriptionSynchronizer,
    private readonly packs?: IPurchasedCreditPackRepository,
    private readonly audit?: IAuditLogger,
  ) {}

  async handle(cmd: ProcessBillingWebhookCommand): Promise<Result<ProcessBillingWebhookResult, DomainError>> {
    const verified = this.billing.verifyAndParseWebhook(cmd.rawBody, cmd.signature);
    if (!verified.ok) return verified;
    const event = verified.value;

    const checksum = sha256(cmd.rawBody);
    const inboxId = crypto.randomUUID();
    const inserted = await this.inbox.create({
      id: inboxId,
      provider: cmd.provider,
      providerEventId: event.eventId,
      eventType: event.eventType,
      providerCreatedAt: event.providerCreatedAt,
      tenantId: event.subscription || event.oneOffPurchase ? await this.resolveTenant(event) : undefined,
      payloadChecksum: checksum,
    });
    if (!inserted.ok) {
      // Duplicate provider event id: already received. Return handled with no
      // effects so the provider stops retrying.
      return { ok: true, value: { handled: false, eventId: event.eventId } };
    }

    await this.inbox.markProcessing(inboxId, 1);
    const processResult = await this.processEvent(event);
    if (!processResult.ok) {
      await this.inbox.markFailed(inboxId, processResult.error.message);
      return processResult;
    }
    await this.inbox.markProcessed(inboxId);

    return {
      ok: true,
      value: { handled: true, eventId: event.eventId, eventType: event.eventType, inboxId },
    };
  }

  private async processEvent(event: ProviderBillingEvent): Promise<Result<void, DomainError>> {
    if (event.oneOffPurchase) {
      return this.processOneOffPurchase(event);
    }
    if (REFUND_EVENT_TYPES.has(event.eventType) && event.orderId) {
      return this.processRefundOrDispute(event);
    }
    if (!event.subscription) {
      // Events without subscription context and not recognized above (e.g. a
      // subscription checkout.completed, which the subscription sync events
      // already cover) are recorded but do not grant paid access by themselves.
      return { ok: true, value: undefined };
    }

    // Re-fetch when the event is incomplete or we are reconciling.
    let effective = event.subscription;
    if (event.eventType !== "subscription.paid" && event.eventType !== "subscription.active") {
      const refreshed = await this.billing.getSubscription(event.subscription.providerSubscriptionId);
      if (refreshed.ok && refreshed.value.providerUpdatedAt && event.subscription.providerUpdatedAt &&
          refreshed.value.providerUpdatedAt.getTime() >= event.subscription.providerUpdatedAt.getTime()) {
        effective = refreshed.value;
      }
    }

    const tenantId = await this.resolveTenant(event, effective.providerSubscriptionId);
    if (!tenantId) {
      return { ok: false, error: DomainError.billingStateInvalid("Webhook references an unknown customer/subscription.") };
    }

    const synced = await this.synchronizer.sync(effective, event.eventType, tenantId);
    if (!synced.ok) return synced;
    return { ok: true, value: undefined };
  }

  private async processOneOffPurchase(event: ProviderBillingEvent): Promise<Result<void, DomainError>> {
    if (!this.packs) return { ok: true, value: undefined };
    const tenantId = await this.resolveTenant(event);
    if (!tenantId) {
      return { ok: false, error: DomainError.billingStateInvalid("One-off purchase webhook is missing a trusted tenant reference.") };
    }
    if (!event.orderId) {
      return { ok: false, error: DomainError.billingStateInvalid("One-off purchase webhook is missing a provider order id.") };
    }
    // Idempotent even if the inbox dedupe above is ever bypassed: a second
    // checkout.completed for the same order id is a no-op, not a double grant.
    const existing = await this.packs.findByProviderOrderId(event.orderId);
    if (!existing.ok) return existing;
    if (existing.value) return { ok: true, value: undefined };

    const sku = event.oneOffPurchase!.sku;
    const source = packSourceForSku(sku);

    if (source === "GROWTH_STANDING_BALANCE") {
      // Authoritative cap enforcement (§4 WS-D item 5): CreateTopupCheckoutHandler
      // already pre-checks this at checkout time, but the checkout->webhook gap
      // is asynchronous (and provider-side), so the pack is only ever actually
      // minted here. Money was already captured by Creem by this point; a
      // cap breach here is a rare race (e.g. two concurrent purchases) and is
      // handled by not minting a 3rd pack rather than failing the webhook —
      // reconciling an over-cap real-money purchase is a manual SuperAdmin
      // follow-up (comped/refund tooling already exists), flagged here rather
      // than silently dropped.
      const activeResult = await this.packs.listActiveByTenant(tenantId);
      if (!activeResult.ok) return activeResult;
      const activeStandingBalance = activeResult.value.filter((p) => p.source === "GROWTH_STANDING_BALANCE").length;
      if (activeStandingBalance >= MAX_ACTIVE_GROWTH_STANDING_BALANCE_PACKS) {
        await this.audit?.record({
          tenantId: TenantId.create(tenantId),
          actorId: "system:creem-webhook",
          eventType: "billing.credits.standing_balance_capped",
          entityType: "purchased_credit_pack",
          entityId: event.orderId,
          newValue: JSON.stringify({ providerOrderId: event.orderId, activeStandingBalance, cap: MAX_ACTIVE_GROWTH_STANDING_BALANCE_PACKS }),
        });
        return { ok: true, value: undefined };
      }
    }

    const pack = PurchasedCreditPack.create({
      id: crypto.randomUUID(),
      props: {
        tenantId,
        credits: event.oneOffPurchase!.credits,
        source,
        providerOrderId: event.orderId,
        purchasedAt: event.providerCreatedAt ?? new Date(),
      },
    });
    const created = await this.packs.create(pack);
    if (!created.ok) return created;
    await this.audit?.record({
      tenantId: TenantId.create(tenantId),
      actorId: "system:creem-webhook",
      eventType: "billing.credit_pack.purchased",
      entityType: "purchased_credit_pack",
      entityId: pack.id,
      newValue: JSON.stringify({ credits: pack.credits, providerOrderId: pack.providerOrderId, sku, source }),
    });
    return { ok: true, value: undefined };
  }

  private async processRefundOrDispute(event: ProviderBillingEvent): Promise<Result<void, DomainError>> {
    if (!this.packs || !event.orderId) return { ok: true, value: undefined };
    const found = await this.packs.findByProviderOrderId(event.orderId);
    if (!found.ok) return found;
    const pack = found.value;
    if (!pack) {
      // Not every refund/dispute references a credit-pack order (e.g. a
      // subscription refund) — nothing to do here.
      return { ok: true, value: undefined };
    }
    if (pack.status === "REFUNDED") return { ok: true, value: undefined };
    pack.refund();
    const updated = await this.packs.update(pack);
    if (!updated.ok) return updated;
    await this.audit?.record({
      tenantId: TenantId.create(pack.tenantId),
      actorId: "system:creem-webhook",
      eventType: "billing.credit_pack.refunded",
      entityType: "purchased_credit_pack",
      entityId: pack.id,
      newValue: JSON.stringify({ providerOrderId: pack.providerOrderId, eventType: event.eventType }),
    });
    return { ok: true, value: undefined };
  }

  /**
   * Tenant resolution precedence: trusted checkout metadata first (opaque
   * tenant reference recorded server-side at checkout creation), then the
   * locally persisted subscription mapping.
   */
  private async resolveTenant(event: ProviderBillingEvent, providerSubscriptionId?: string): Promise<string | undefined> {
    const metaTenant = event.metadata?.tenant_id;
    if (typeof metaTenant === "string" && /^[A-Za-z0-9_-]{3,128}$/.test(metaTenant)) return metaTenant;
    const subscriptionId = providerSubscriptionId ?? event.subscription?.providerSubscriptionId;
    if (subscriptionId) {
      const existing = await this.subscriptions.findByProviderSubscriptionId(subscriptionId);
      if (existing.ok && existing.value) return existing.value.tenantId;
    }
    return undefined;
  }
}

function sha256(input: Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function assertPlanCode(code: string): Result<"TEAM" | "GROWTH", DomainError> {
  if (code !== "TEAM" && code !== "GROWTH") {
    return { ok: false, error: DomainError.billingStateInvalid(`Unknown plan: ${code}`) };
  }
  return { ok: true, value: code };
}
