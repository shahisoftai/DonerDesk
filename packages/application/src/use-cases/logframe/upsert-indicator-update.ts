import { DomainError, IndicatorUpdate, TenantId, type Result } from "@donordesk/domain";
import type { IIdGenerator } from "../../ports/core.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { UpsertIndicatorUpdateInput } from "@donordesk/contracts";

export interface UpsertOutcome {
  id: string;
  created: boolean;
  changed: boolean;
  /** The value the row held before this save (undefined when it was just created). */
  previousValue?: string;
}

/**
 * Shared upsert used by the single-create and bulk-save indicator entry flows.
 * Creates a DRAFT update when none exists for the indicator+period; otherwise
 * applies the edit to the existing draft. Verified updates are intentionally
 * left untouched; fields the input leaves out keep their stored value so approved figures cannot be silently overwritten.
 * Callers validate `input.disaggregation` against the indicator first.
 */
export async function upsertIndicatorUpdate(
  ids: IIdGenerator,
  repo: IIndicatorUpdateRepository,
  tenantId: TenantId,
  userId: string,
  reportingPeriodId: string,
  input: UpsertIndicatorUpdateInput,
  /** Runs once, right after a value is first created (e.g. to attach evidence already tagged to it). */
  afterCreate?: (update: IndicatorUpdate) => Promise<Result<unknown, DomainError>>,
): Promise<Result<UpsertOutcome, DomainError>> {
  const existingResult = await repo.findByIndicatorAndPeriod(input.indicatorId, reportingPeriodId, tenantId);
  if (!existingResult.ok) return existingResult;

  const existing = existingResult.value;
  if (existing) {
    if (existing.verificationStatus === "VERIFIED") {
      return { ok: true, value: { id: existing.id, created: false, changed: false } };
    }
    const previousValue = existing.periodAchievement;
    // A field the caller did not send keeps what is stored; an empty string clears it.
    existing.edit({
      periodAchievement: input.periodAchievement,
      cumulativeAchievement: input.cumulativeAchievement,
      ...(input.comments !== undefined ? { comments: input.comments.trim() || undefined } : {}),
      ...(input.dataSource !== undefined ? { dataSource: input.dataSource.trim() || undefined } : {}),
      ...(input.disaggregation ? { disaggregation: input.disaggregation } : {}),
    });
    const saved = await repo.update(existing);
    if (!saved.ok) return saved;
    return { ok: true, value: { id: existing.id, created: false, changed: true, previousValue } };
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
    disaggregation: input.disaggregation,
    createdById: userId,
  });
  const saved = await repo.create(update);
  if (!saved.ok) return saved;
  if (afterCreate) {
    const after = await afterCreate(update);
    if (!after.ok) return after;
  }
  return { ok: true, value: { id, created: true, changed: true } };
}
