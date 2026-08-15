import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { IEntitlementGrantRepository } from "../../ports/billing.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";

export interface ExpireLocalTrialsResult {
  /** Trial grants that were already past their window. */
  expired: number;
}

/**
 * Scheduled reconciliation for local trials.
 *
 * Entitlement grants are append-oriented and time-bounded; the pure
 * entitlement calculator already ignores expired windows on every read
 * (lazy enforcement), so a late job can never extend access. This handler
 * verifies the invariant and audits the reconciliation pass.
 */
export class ExpireLocalTrialsHandler {
  constructor(
    private readonly grants: IEntitlementGrantRepository,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  async handle(): Promise<Result<ExpireLocalTrialsResult, DomainError>> {
    const now = this.clock.now();
    const trials = await this.grants.listExpiredTrialGrants(now);
    if (!trials.ok) return trials;

    const expired = trials.value.length;
    if (expired > 0) {
      await this.audit.record({
        tenantId: { toString: () => "*" } as import("@donordesk/domain").TenantId,
        actorId: "system",
        eventType: "billing.trials.reconciled",
        entityType: "billing",
        entityId: `expired=${expired}`,
        newValue: JSON.stringify({ expiredTrials: expired, at: now.toISOString() }),
      });
    }

    return { ok: true, value: { expired } };
  }
}
