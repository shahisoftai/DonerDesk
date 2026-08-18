import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { BillingProvider } from "../../ports/billing.js";
import type { IBillingSubscriptionRepository } from "../../ports/billing.js";
import { BillingSubscriptionSynchronizer } from "../../services/billing-subscription-synchronizer.js";
import type { IClock, IAuditLogger } from "../../ports/core.js";

export interface ReconcileBillingSubscriptionsResult {
  /** Subscriptions inspected. */
  scanned: number;
  /** Subscriptions re-synced with fresh provider state. */
  synced: number;
  /** Subscriptions that failed to reconcile (count + ids). */
  failed: Array<{ subscriptionId: string; error: string }>;
}

/**
 * Scheduled daily reconciliation of non-terminal subscriptions.
 *
 * Webhooks are notifications, not the only recovery mechanism: a missed or
 * undelivered event must converge. This handler picks subscriptions that were
 * never synced or are stale (lastSyncedAt older than a threshold) and re-fetches
 * their authoritative state from the provider through the shared synchronizer.
 * It is idempotent: re-running after convergence is a no-op.
 */
export class ReconcileBillingSubscriptionsHandler {
  constructor(
    private readonly billing: BillingProvider,
    private readonly subscriptions: IBillingSubscriptionRepository,
    private readonly synchronizer: BillingSubscriptionSynchronizer,
    private readonly clock: IClock,
    private readonly audit: IAuditLogger,
    private readonly staleAfterMs = 6 * 60 * 60 * 1000,
  ) {}

  async handle(): Promise<Result<ReconcileBillingSubscriptionsResult, DomainError>> {
    const now = this.clock.now();
    const staleBefore = new Date(now.getTime() - this.staleAfterMs);
    const candidates = await this.subscriptions.listReconcileCandidates(staleBefore);
    if (!candidates.ok) return candidates;

    const result: ReconcileBillingSubscriptionsResult = { scanned: candidates.value.length, synced: 0, failed: [] };
    for (const sub of candidates.value) {
      const refreshed = await this.billing.getSubscription(sub.providerSubscriptionId);
      if (!refreshed.ok) {
        result.failed.push({ subscriptionId: sub.id, error: refreshed.error.message });
        continue;
      }
      // Only apply when the provider state is at least as fresh as ours.
      if (refreshed.value.providerUpdatedAt && sub.providerUpdatedAt &&
          refreshed.value.providerUpdatedAt.getTime() < sub.providerUpdatedAt.getTime()) {
        continue;
      }
      const synced = await this.synchronizer.sync(refreshed.value, "reconcile.daily", sub.tenantId);
      if (!synced.ok) {
        result.failed.push({ subscriptionId: sub.id, error: synced.error.message });
        continue;
      }
      result.synced += 1;
    }

    if (result.scanned > 0) {
      await this.audit.record({
        tenantId: { toString: () => "*" } as import("@donordesk/domain").TenantId,
        actorId: "system",
        eventType: "billing.subscriptions.reconciled",
        entityType: "billing",
        entityId: `scanned=${result.scanned}`,
        newValue: JSON.stringify({ ...result, at: now.toISOString() }),
      });
    }

    return { ok: true, value: result };
  }
}
