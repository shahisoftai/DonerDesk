import { createHash } from "node:crypto";
import type { Result } from "@donordesk/domain";
import {
  DomainError,
  BillingSubscription,
  EntitlementGrant,
  isPlanCode,
  type BillingSubscriptionStatus,
} from "@donordesk/domain";
import type { BillingProvider, ProviderBillingEvent, ProviderSubscription } from "../../ports/billing.js";
import type {
  IBillingSubscriptionRepository,
  IEntitlementGrantRepository,
  IBillingEventInboxRepository,
} from "../../ports/billing.js";
import type { IIdGenerator, IAuditLogger, IClock } from "../../ports/core.js";

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
 * 3. Resolve the tenant from trusted request metadata; where the event is
 *    stale/incomplete, re-fetch the current subscription from the provider.
 * 4. Transactionally sync the subscription, change entitlement grants, audit,
 *    and mark the inbox row processed.
 *
 * The application owns entitlement changes; the adapter only maps provider
 * objects/events (SRP/DIP).
 */
export class ProcessBillingWebhookHandler {
  constructor(
    private readonly billing: BillingProvider,
    private readonly subscriptions: IBillingSubscriptionRepository,
    private readonly grants: IEntitlementGrantRepository,
    private readonly inbox: IBillingEventInboxRepository,
    private readonly ids: IIdGenerator,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  async handle(cmd: ProcessBillingWebhookCommand): Promise<Result<ProcessBillingWebhookResult, DomainError>> {
    const verified = this.billing.verifyAndParseWebhook(cmd.rawBody, cmd.signature);
    if (!verified.ok) return verified;
    const event = verified.value;

    const checksum = sha256(cmd.rawBody);
    const inboxId = this.ids.generate();
    const inserted = await this.inbox.create({
      id: inboxId,
      provider: cmd.provider,
      providerEventId: event.eventId,
      eventType: event.eventType,
      providerCreatedAt: event.providerCreatedAt,
      tenantId: event.subscription ? await this.resolveTenantFromSubscription(event.subscription.providerSubscriptionId) : undefined,
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

    const tenantId = await this.resolveTenantFromSubscription(effective.providerSubscriptionId);
    if (!tenantId) {
      return { ok: false, error: DomainError.billingStateInvalid("Webhook references an unknown customer/subscription.") };
    }

    const now = this.clock.now();
    const existing = await this.subscriptions.findByProviderSubscriptionId(effective.providerSubscriptionId);

    let subscription: BillingSubscription;
    if (existing.ok && existing.value) {
      subscription = existing.value;
      subscription.syncFromProvider({
        status: effective.status,
        planCode: effective.planCode,
        catalogVersion: 1,
        providerProductId: effective.providerProductId,
        currency: effective.currency,
        unitAmountMinor: effective.unitAmountMinor,
        billingInterval: effective.billingInterval,
        currentPeriodStart: effective.currentPeriodStart,
        currentPeriodEnd: effective.currentPeriodEnd,
        trialStart: effective.trialStart,
        trialEnd: effective.trialEnd,
        cancelAtPeriodEnd: effective.cancelAtPeriodEnd,
        graceEndsAt: effective.graceEndsAt,
        providerUpdatedAt: effective.providerUpdatedAt,
        now,
      });
      const updated = await this.subscriptions.update(subscription);
      if (!updated.ok) return updated;
    } else {
      subscription = BillingSubscription.create({
        id: this.ids.generate(),
        props: {
          tenantId,
          provider: "CREEM",
          providerCustomerId: effective.providerCustomerId ?? "unknown",
          providerSubscriptionId: effective.providerSubscriptionId,
          providerProductId: effective.providerProductId,
          planCode: effective.planCode,
          catalogVersion: 1,
          status: effective.status,
          currency: effective.currency,
          unitAmountMinor: effective.unitAmountMinor,
          billingInterval: effective.billingInterval,
          currentPeriodStart: effective.currentPeriodStart,
          currentPeriodEnd: effective.currentPeriodEnd,
          trialStart: effective.trialStart,
          trialEnd: effective.trialEnd,
          cancelAtPeriodEnd: effective.cancelAtPeriodEnd,
          graceEndsAt: effective.graceEndsAt,
          providerUpdatedAt: effective.providerUpdatedAt,
          lastSyncedAt: now,
        },
      });
      const created = await this.subscriptions.create(subscription);
      if (!created.ok) return created;
    }

    await this.syncEntitlementGrant(tenantId, subscription, now);

    await this.audit.record({
      tenantId: TenantIdSafe(tenantId),
      actorId: "system",
      eventType: "billing.subscription.synced",
      entityType: "billing_subscription",
      entityId: subscription.id,
      newValue: JSON.stringify({
        providerEvent: event.eventType,
        status: effective.status,
        plan: effective.planCode,
      }),
    });

    return { ok: true, value: undefined };
  }

  private async syncEntitlementGrant(
    tenantId: string,
    subscription: BillingSubscription,
    now: Date,
  ): Promise<Result<void, DomainError>> {
    const activeGrantStatuses: BillingSubscriptionStatus[] = ["ACTIVE", "TRIALING", "PAST_DUE"];
    const grantsAccess = activeGrantStatuses.includes(subscription.status);

    const existingGrants = await this.grants.listByTenant(tenantId);
    if (!existingGrants.ok) return existingGrants;
    const linked = existingGrants.value.filter((g) => g.billingSubscriptionId === subscription.id);

    if (grantsAccess) {
      if (linked.length === 0) {
        const grant = EntitlementGrant.create({
          id: this.ids.generate(),
          props: {
            tenantId,
            planCode: subscription.planCode,
            source: "CREEM_SUBSCRIPTION",
            effectiveFrom: subscription.currentPeriodStart ?? now,
            effectiveUntil: subscription.currentPeriodEnd,
            billingSubscriptionId: subscription.id,
            createdById: "system",
            reason: "subscription-sync",
          },
        });
        const created = await this.grants.create(grant);
        if (!created.ok) return created;
      }
      return { ok: true, value: undefined };
    }

    // Subscription stopped granting access (cancelled/expired): end the linked
    // grant at the confirmed access end so the fallback (Starter) becomes
    // effective. EntitlementGrant is immutable; end-of-life is modeled by a
    // time-bounded grant whose effectiveUntil already reflects it.
    for (const grant of linked) {
      if (grant.effectiveUntil === undefined) {
        // Terminate immediately: the subscription no longer grants access.
        const terminated = EntitlementGrant.create({
          id: this.ids.generate(),
          props: {
            tenantId,
            planCode: grant.planCode,
            source: "CREEM_SUBSCRIPTION",
            effectiveFrom: now,
            effectiveUntil: now,
            billingSubscriptionId: subscription.id,
            createdById: "system",
            reason: "subscription-end",
          },
        });
        const created = await this.grants.create(terminated);
        if (!created.ok) return created;
      }
    }
    return { ok: true, value: undefined };
  }

  /** Tenant is resolved from the provider metadata recorded at checkout. */
  private async resolveTenantFromSubscription(providerSubscriptionId: string): Promise<string | undefined> {
    const existing = await this.subscriptions.findByProviderSubscriptionId(providerSubscriptionId);
    if (existing.ok && existing.value) return existing.value.tenantId;
    return undefined;
  }
}

function TenantIdSafe(tenantId: string): import("@donordesk/domain").TenantId {
  return { toString: () => tenantId } as import("@donordesk/domain").TenantId;
}

function sha256(input: Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function assertPlanCode(code: string): Result<"TEAM" | "GROWTH", DomainError> {
  if (!isPlanCode(code)) return { ok: false, error: DomainError.billingStateInvalid(`Unknown plan: ${code}`) };
  if (code === "ENTERPRISE" || code === "STARTER") {
    return { ok: false, error: DomainError.billingStateInvalid(`Plan ${code} is not sold via checkout.`) };
  }
  return { ok: true, value: code as "TEAM" | "GROWTH" };
}
