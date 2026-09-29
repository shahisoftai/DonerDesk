import type { Result } from "@donordesk/domain";
import { DomainError, BillingSubscription, EntitlementGrant, PLAN_CATALOG_VERSION, type BillingSubscriptionStatus } from "@donordesk/domain";
import type { BillingProvider, ProviderSubscription } from "../ports/billing.js";
import type {
  IBillingSubscriptionRepository,
  IEntitlementGrantRepository,
  IPurchasedCreditPackRepository,
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
    private readonly packs?: IPurchasedCreditPackRepository,
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
        catalogVersion: PLAN_CATALOG_VERSION,
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
          catalogVersion: PLAN_CATALOG_VERSION,
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

    // §4 WS-D item 3b: a Growth-only standing-balance pack is exempt from the
    // "packs survive a downgrade" rule that applies to regular top-ups — it
    // stops drawing down the moment the tenant's effective plan is no longer
    // GROWTH (covers both a downgrade to TEAM/STARTER while still subscribed,
    // and a full cancellation/expiry). Regular TOPUP packs are untouched.
    const grantsAccess = ["ACTIVE", "TRIALING", "PAST_DUE"].includes(subscription.status);
    const stillGrowth = grantsAccess && subscription.planCode === "GROWTH";
    if (!stillGrowth) {
      const suspended = await this.suspendGrowthStandingBalancePacks(tenantId);
      if (!suspended.ok) return suspended;
    } else {
      // Inverse of the suspension above: a tenant who re-subscribes to GROWTH
      // after a downgrade gets their paid standing balance back — without this
      // the SUSPENDED packs would be stranded (unspendable, invisible to
      // draw-down) forever even though the tenant paid for those credits.
      const reactivated = await this.reactivateGrowthStandingBalancePacks(tenantId);
      if (!reactivated.ok) return reactivated;
    }

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
      // Grant lifecycle invariant: exactly one open linked grant covers `now`
      // at the subscription's current plan and period. Grants are append-only
      // for *creation*, so drift is corrected by ending the stale window in
      // place (endGrant) and creating a fresh one. This is what makes renewals
      // work at all: a grant created at subscription start carries
      // `effectiveUntil = that period's end`, so a renewal that only advanced
      // `currentPeriodEnd` would otherwise leave the paying tenant with no
      // effective grant (silent STARTER fallback), and a mid-cycle
      // TEAM<->GROWTH plan change would keep provisioning the old plan until
      // the stale window ran out.
      const openLinked = linked.filter(
        (g) => g.effectiveUntil === undefined || g.effectiveUntil.getTime() > now.getTime(),
      );
      for (const grant of openLinked) {
        const stalePlan = grant.planCode !== subscription.planCode;
        const stalePeriod =
          subscription.currentPeriodEnd !== undefined &&
          (grant.effectiveUntil === undefined ||
            grant.effectiveUntil.getTime() !== subscription.currentPeriodEnd.getTime());
        if (!stalePlan && !stalePeriod) continue;
        // Preserve the domain invariant effectiveUntil > effectiveFrom even
        // for a not-yet-started (future) grant picked up by the open filter
        // (or one created in this very millisecond).
        const endAt = new Date(Math.max(now.getTime(), grant.effectiveFrom.getTime() + 1));
        const ended = await this.grants.endGrant(grant.id, endAt);
        if (!ended.ok) return ended;
        await this.audit.record({
          tenantId: tenantIdSafe(tenantId),
          actorId: "system",
          eventType: "billing.subscription.grant_ended",
          entityType: "entitlement_grant",
          entityId: grant.id,
          oldValue: JSON.stringify({ planCode: grant.planCode, effectiveUntil: grant.effectiveUntil?.toISOString() ?? null }),
          newValue: JSON.stringify({
            reason: stalePlan ? "subscription-plan-change" : "subscription-renewed",
            plan: subscription.planCode,
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          }),
        });
      }
      const covered = openLinked.some(
        (g) =>
          g.planCode === subscription.planCode &&
          g.isEffectiveAt(now) &&
          (subscription.currentPeriodEnd === undefined ||
            (g.effectiveUntil !== undefined && g.effectiveUntil.getTime() === subscription.currentPeriodEnd.getTime())),
      );
      if (!covered) {
        const grant = EntitlementGrant.create({
          id: this.ids.generate(),
          props: {
            tenantId,
            planCode: subscription.planCode,
            source: "CREEM_SUBSCRIPTION",
            effectiveFrom: now,
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

  /**
   * One-time admin notice per pack: `suspendForDowngrade()` only transitions
   * a pack that is currently ACTIVE, so the audit record below only fires the
   * first time a given pack crosses out of GROWTH — a later sync for the same
   * tenant (still not on GROWTH) finds no ACTIVE standing-balance packs left
   * to suspend and is a no-op.
   */
  private async suspendGrowthStandingBalancePacks(tenantId: string): Promise<Result<void, DomainError>> {
    if (!this.packs) return { ok: true, value: undefined };
    const active = await this.packs.listByTenant(tenantId);
    if (!active.ok) return active;
    const standingBalancePacks = active.value.filter((p) => p.source === "GROWTH_STANDING_BALANCE" && p.status === "ACTIVE");
    for (const pack of standingBalancePacks) {
      pack.suspendForDowngrade();
      const updated = await this.packs.update(pack);
      if (!updated.ok) return updated;
      await this.audit.record({
        tenantId: tenantIdSafe(tenantId),
        actorId: "system",
        eventType: "billing.credits.standing_balance_suspended",
        entityType: "purchased_credit_pack",
        entityId: pack.id,
        newValue: JSON.stringify({ reason: "downgrade_or_cancellation", remainingCredits: pack.remaining }),
      });
    }
    return { ok: true, value: undefined };
  }

  /**
   * Inverse of `suspendGrowthStandingBalancePacks`: on a sync where the
   * subscription again grants GROWTH access, SUSPENDED standing-balance packs
   * return to ACTIVE draw-down with their remaining credits intact. Fires once
   * per pack (a later sync finds no SUSPENDED packs left). Idempotent and
   * never touches REFUNDED/EXHAUSTED packs.
   */
  private async reactivateGrowthStandingBalancePacks(tenantId: string): Promise<Result<void, DomainError>> {
    if (!this.packs) return { ok: true, value: undefined };
    const all = await this.packs.listByTenant(tenantId);
    if (!all.ok) return all;
    const suspendedPacks = all.value.filter((p) => p.source === "GROWTH_STANDING_BALANCE" && p.status === "SUSPENDED");
    for (const pack of suspendedPacks) {
      pack.reactivate();
      const updated = await this.packs.update(pack);
      if (!updated.ok) return updated;
      await this.audit.record({
        tenantId: tenantIdSafe(tenantId),
        actorId: "system",
        eventType: "billing.credits.standing_balance_reactivated",
        entityType: "purchased_credit_pack",
        entityId: pack.id,
        newValue: JSON.stringify({ reason: "resubscribed_to_growth", remainingCredits: pack.remaining }),
      });
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
