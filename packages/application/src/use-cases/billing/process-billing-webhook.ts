import { createHash } from "node:crypto";
import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { BillingProvider, ProviderBillingEvent } from "../../ports/billing.js";
import type {
  IBillingSubscriptionRepository,
  IBillingEventInboxRepository,
} from "../../ports/billing.js";
import { BillingSubscriptionSynchronizer } from "../../services/billing-subscription-synchronizer.js";

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
      tenantId: event.subscription
        ? await this.resolveTenant(event)
        : undefined,
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
    if (!event.subscription) {
      // Events without subscription context (e.g. checkout.completed mapping)
      // are recorded but do not grant paid access by themselves.
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
