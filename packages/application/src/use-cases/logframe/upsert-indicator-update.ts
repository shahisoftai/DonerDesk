import { DomainError, IndicatorUpdate, TenantId, type Result } from "@donordesk/domain";
import type { IIdGenerator } from "../../ports/core.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { UpsertIndicatorUpdateInput } from "@donordesk/contracts";

export interface UpsertOutcome {
  id: string;
  created: boolean;
  changed: boolean;
}

/**
 * Shared upsert used by the single-create and bulk-save indicator entry flows.
 * Creates a DRAFT update when none exists for the indicator+period; otherwise
 * applies the edit to the existing draft. Verified updates are intentionally
 * left untouched so approved figures cannot be silently overwritten.
 */
export async function upsertIndicatorUpdate(
  ids: IIdGenerator,
  repo: IIndicatorUpdateRepository,
  tenantId: TenantId,
  userId: string,
  reportingPeriodId: string,
  input: UpsertIndicatorUpdateInput,
): Promise<Result<UpsertOutcome, DomainError>> {
  const existingResult = await repo.findByIndicatorAndPeriod(input.indicatorId, reportingPeriodId, tenantId);
  if (!existingResult.ok) return existingResult;

  const existing = existingResult.value;
  if (existing) {
    if (existing.verificationStatus === "VERIFIED") {
      return { ok: true, value: { id: existing.id, created: false, changed: false } };
    }
    existing.edit({
      periodAchievement: input.periodAchievement,
      cumulativeAchievement: input.cumulativeAchievement,
      comments: input.comments,
      dataSource: input.dataSource,
    });
    const saved = await repo.update(existing);
    if (!saved.ok) return saved;
    return { ok: true, value: { id: existing.id, created: false, changed: true } };
  }

  const id = ids.generate();
  const update = IndicatorUpdate.create({
    id,
    tenantId: tenantId.toString(),
    indicatorId: input.indicatorId,
    reportingPeriodId,
    periodAchievement: input.periodAchievement,
    cumulativeAchievement: input.cumulativeAchievement,
    comments: input.comments,
    dataSource: input.dataSource,
    createdById: userId,
  });
  const saved = await repo.create(update);
  if (!saved.ok) return saved;
  return { ok: true, value: { id, created: true, changed: true } };
}
