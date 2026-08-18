import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { BillingProvider, IBillingSubscriptionRepository, IBillingEventInboxRepository } from "../../ports/billing.js";
import { BillingSubscriptionSynchronizer } from "../../services/billing-subscription-synchronizer.js";
import type { IClock, IAuditLogger } from "../../ports/core.js";

export interface RetryBillingInboxResult {
  /** Events that were stuck in PROCESSING. */
  scanned: number;
  /** Events re-driven against current provider state. */
  processed: number;
  /** Events that could not be recovered. */
  failed: Array<{ inboxId: string; error: string }>;
}

/**
 * Frequent inbox retry for events stuck in PROCESSING (worker crashed between
 * claim and commit). The inbox stores a checksum, not the full payload, so a
 * stuck event is recovered by re-fetching the tenant's CURRENT subscription
 * state from the provider and re-syncing through the shared synchronizer. This
 * converges to the same state the event would have produced; replay is
 * idempotent by construction.
 */
export class RetryBillingInboxHandler {
  constructor(
    private readonly billing: BillingProvider,
    private readonly subscriptions: IBillingSubscriptionRepository,
    private readonly inbox: IBillingEventInboxRepository,
    private readonly synchronizer: BillingSubscriptionSynchronizer,
    private readonly clock: IClock,
    private readonly audit: IAuditLogger,
    private readonly staleAfterMs = 15 * 60 * 1000,
    private readonly maxAttempts = 5,
  ) {}

  async handle(): Promise<Result<RetryBillingInboxResult, DomainError>> {
    const now = this.clock.now();
    const olderThan = new Date(now.getTime() - this.staleAfterMs);
    const stuck = await this.inbox.listStaleProcessing(olderThan);
    if (!stuck.ok) return stuck;

    const result: RetryBillingInboxResult = { scanned: stuck.value.length, processed: 0, failed: [] };
    for (const row of stuck.value) {
      const attempt = row.attemptCount + 1;
      await this.inbox.markProcessing(row.id, attempt);

      // Events without a resolved tenant cannot be recovered here; they are
      // left for manual review (unknown customer/subscription).
      if (!row.tenantId) {
        await this.inbox.markFailed(row.id, "No tenant could be resolved; manual review required");
        result.failed.push({ inboxId: row.id, error: "No tenant could be resolved" });
        continue;
      }

      const subscription = await this.subscriptions.findAccessGrantingByTenant(row.tenantId);
      if (!subscription.ok) {
        result.failed.push({ inboxId: row.id, error: subscription.error.message });
        continue;
      }
      if (!subscription.value) {
        await this.inbox.markProcessed(row.id);
        result.processed += 1;
        continue;
      }

      const refreshed = await this.billing.getSubscription(subscription.value.providerSubscriptionId);
      if (!refreshed.ok) {
        if (attempt >= this.maxAttempts) {
          await this.inbox.markFailed(row.id, refreshed.error.message);
        }
        result.failed.push({ inboxId: row.id, error: refreshed.error.message });
        continue;
      }

      const synced = await this.synchronizer.sync(refreshed.value, "retry.inbox", row.tenantId);
      if (!synced.ok) {
        if (attempt >= this.maxAttempts) {
          await this.inbox.markFailed(row.id, synced.error.message);
        }
        result.failed.push({ inboxId: row.id, error: synced.error.message });
        continue;
      }

      await this.inbox.markProcessed(row.id);
      result.processed += 1;
    }

    if (result.scanned > 0) {
      await this.audit.record({
        tenantId: { toString: () => "*" } as import("@donordesk/domain").TenantId,
        actorId: "system",
        eventType: "billing.inbox.retried",
        entityType: "billing",
        entityId: `scanned=${result.scanned}`,
        newValue: JSON.stringify({ ...result, at: now.toISOString() }),
      });
    }

    return { ok: true, value: result };
  }
}
