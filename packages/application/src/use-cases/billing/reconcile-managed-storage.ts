import type { Result } from "@donordesk/domain";
import { DomainError, TenantId } from "@donordesk/domain";
import type { IUsageCounterRepository } from "../../ports/billing.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IClock, IAuditLogger } from "../../ports/core.js";
import { monthStartUtc, USAGE_METRIC_STORAGE } from "./_usage.js";

export interface ReconcileManagedStorageResult {
  /** Tenants inspected. */
  scanned: number;
  /** Tenants whose counter was corrected to the authoritative sum. */
  corrected: number;
  /** (tenantId, stored, authoritative) triples where drift was found. */
  drift: Array<{ tenantId: string; stored: string; authoritative: string }>;
}

/**
 * Periodic storage reconciliation. The managed-storage counter is a running
 * reservation; a failed release (crash between save and finalize) can leave it
 * above the authoritative count of persisted managed bytes. This handler
 * recomputes the authoritative sum from evidence rows and only ever REDUCES the
 * counter to that sum — it never grows usage, so a concurrent upload that
 * legitimately increased the counter is preserved.
 */
export class ReconcileManagedStorageUsageHandler {
  constructor(
    private readonly usage: IUsageCounterRepository,
    private readonly evidence: IEvidenceRepository,
    private readonly clock: IClock,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(): Promise<Result<ReconcileManagedStorageResult, DomainError>> {
    const now = this.clock.now();
    const periodStart = monthStartUtc(now);

    const counters = await this.usage.listByMetric(USAGE_METRIC_STORAGE, periodStart);
    if (!counters.ok) return counters;

    const result: ReconcileManagedStorageResult = { scanned: counters.value.length, corrected: 0, drift: [] };
    for (const { tenantId, counter } of counters.value) {
      const tenantIdValue = TenantId.create(tenantId);
      const authoritativeResult = await this.evidence.sumManagedStorageBytes(tenantIdValue);
      if (!authoritativeResult.ok) continue;
      const authoritative = authoritativeResult.value;
      if (counter.used > authoritative) {
        const corrected = await this.usage.setUsed(tenantId, USAGE_METRIC_STORAGE, periodStart, authoritative);
        if (!corrected.ok) continue;
        result.corrected += 1;
        result.drift.push({
          tenantId,
          stored: counter.used.toString(),
          authoritative: authoritative.toString(),
        });
      }
    }

    if (result.drift.length > 0) {
      await this.audit.record({
        tenantId: { toString: () => "*" } as import("@donordesk/domain").TenantId,
        actorId: "system",
        eventType: "billing.storage.reconciled",
        entityType: "billing",
        entityId: `corrected=${result.corrected}`,
        newValue: JSON.stringify({ ...result, at: now.toISOString() }),
      });
    }

    return { ok: true, value: result };
  }
}
