import type { Result } from "@donordesk/domain";
import { DomainError, BillingSubscription, EntitlementGrant, type BillingSubscriptionStatus } from "@donordesk/domain";
import type { BillingProvider, ProviderSubscription } from "../ports/billing.js";
import type {
  IBillingSubscriptionRepository,
  IEntitlementGrantRepository,
} from "../ports/billing.js";
import type { IIdGenerator, IAuditLogger, IClock } from "../ports/core.js";

export interface SynchronizedSubscription {
  subscriptionId: string;
  tenantId: string;
  status: string;
  planCode: string;
}

/**
 * Applies a provider subscription snapshot to local state: upserts the
 * BillingSubscription, transitions the linked entitlement grant to match the
 * provider status, and records an audit trail. Used by both the webhook
 * processor and the scheduled reconciliation handler so provider state is
 * mapped through exactly one code path (SRP/DRY/DIP).
 */
export class BillingSubscriptionSynchronizer {
  constructor(
    private readonly billing: BillingProvider,
    private readonly subscriptions: IBillingSubscriptionRepository,
    private readonly grants: IEntitlementGrantRepository,
    private readonly ids: IIdGenerator,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  async sync(
    effective: ProviderSubscription,
    eventType: string,
    sourceTenantId?: string,
  ): Promise<Result<SynchronizedSubscription, DomainError>> {
    const tenantId = sourceTenantId ?? await this.resolveTenantFromSubscription(effective.providerSubscriptionId);
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

    const grantResult = await this.syncEntitlementGrant(tenantId, subscription, now);
    if (!grantResult.ok) return grantResult;

    await this.audit.record({
      tenantId: tenantIdSafe(tenantId),
      actorId: "system",
      eventType: "billing.subscription.synced",
      entityType: "billing_subscription",
      entityId: subscription.id,
      newValue: JSON.stringify({
        providerEvent: eventType,
        status: effective.status,
        plan: effective.planCode,
      }),
    });

    return { ok: true, value: { subscriptionId: subscription.id, tenantId, status: subscription.status, planCode: subscription.planCode } };
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

    // Subscription stopped granting access (cancelled/expired): end any open
    // linked grant so the fallback (Starter) becomes effective. EntitlementGrant
    // is append-oriented; end-of-life is modeled by ending the window. The
    // window [now - 1ms, now] keeps the domain invariant (effectiveUntil after
    // effectiveFrom) while remaining immediately expired for isEffectiveAt.
    for (const grant of linked) {
      if (grant.effectiveUntil === undefined) {
        const terminated = EntitlementGrant.create({
          id: this.ids.generate(),
          props: {
            tenantId,
            planCode: grant.planCode,
            source: "CREEM_SUBSCRIPTION",
            effectiveFrom: new Date(now.getTime() - 1),
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

  private async resolveTenantFromSubscription(providerSubscriptionId: string): Promise<string | undefined> {
    const existing = await this.subscriptions.findByProviderSubscriptionId(providerSubscriptionId);
    if (existing.ok && existing.value) return existing.value.tenantId;
    return undefined;
  }
}

function tenantIdSafe(tenantId: string): import("@donordesk/domain").TenantId {
  return { toString: () => tenantId } as import("@donordesk/domain").TenantId;
}
