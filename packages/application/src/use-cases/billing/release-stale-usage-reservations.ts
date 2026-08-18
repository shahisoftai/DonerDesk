import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { IUsageCounterRepository, ILlmUsageRepository } from "../../ports/billing.js";
import type { IClock, IAuditLogger } from "../../ports/core.js";
import { monthStartUtc, USAGE_METRIC_AI_CREDITS } from "./_usage.js";

export interface ReleaseStaleUsageReservationsResult {
  /** Counters inspected. */
  scanned: number;
  /** Counters whose stale reservation was released. */
  released: number;
  releasedUnits: string;
}

/**
 * Hourly stale-reservation release for AI draft credits.
 *
 * A credit is reserved atomically (a +1 delta on the counter) before LLM
 * generation and released on failure or consumed on success. If the process
 * crashes between reservation and finalization, the reservation leaks. The AI
 * counter self-heals against the LLM ledger on every read, but this job makes
 * the correction durable and hourly so leaked reservations cannot accumulate.
 *
 * The LLM run ledger is the authoritative source: `used` is clamped down to the
 * number of successfully persisted real AI drafts. Only reductions are applied;
 * a concurrent in-flight generation that legitimately incremented the counter
 * is preserved.
 */
export class ReleaseStaleUsageReservationsHandler {
  constructor(
    private readonly usage: IUsageCounterRepository,
    private readonly llmRuns: ILlmUsageRepository,
    private readonly clock: IClock,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(): Promise<Result<ReleaseStaleUsageReservationsResult, DomainError>> {
    const now = this.clock.now();
    const monthStart = monthStartUtc(now);

    const counters = await this.usage.listByMetric(USAGE_METRIC_AI_CREDITS, monthStart);
    if (!counters.ok) return counters;

    const result: ReleaseStaleUsageReservationsResult = { scanned: counters.value.length, released: 0, releasedUnits: "0" };
    let releasedUnits = 0n;

    for (const { tenantId, counter } of counters.value) {
      const ledger = await this.llmRuns.countAiReportDrafts(tenantId, monthStart);
      if (!ledger.ok) continue;
      const authoritative = BigInt(ledger.value);
      if (counter.used <= authoritative) continue;
      const released = await this.usage.setUsed(tenantId, USAGE_METRIC_AI_CREDITS, monthStart, authoritative);
      if (!released.ok) continue;
      result.released += 1;
      releasedUnits += counter.used - authoritative;
    }

    if (result.released > 0) {
      result.releasedUnits = releasedUnits.toString();
      await this.audit.record({
        tenantId: { toString: () => "*" } as import("@donordesk/domain").TenantId,
        actorId: "system",
        eventType: "billing.usage.reservations_released",
        entityType: "billing",
        entityId: `released=${result.released}`,
        newValue: JSON.stringify({ ...result, at: now.toISOString() }),
      });
    }

    return { ok: true, value: result };
  }
}
