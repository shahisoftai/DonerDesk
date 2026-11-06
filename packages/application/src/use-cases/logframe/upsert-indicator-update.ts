import { DomainError, IndicatorUpdate, TenantId, type Result } from "@donordesk/domain";
import type { IIdGenerator } from "../../ports/core.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { UpsertIndicatorUpdateInput } from "@donordesk/contracts";

/**
 * What the save says about "not applicable": a reason makes the value an answer with no figure, "" clears it, and an
 * omitted field keeps the stored answer unless a figure is typed (a typed figure means the indicator applies after all).
 */
export function notApplicableAnswer(input: UpsertIndicatorUpdateInput, stored: string | undefined): string | undefined {
  if (input.notApplicableReason !== undefined) return input.notApplicableReason.trim() || undefined;
  if (stored !== undefined && (input.periodAchievement.trim() !== "" || input.cumulativeAchievement.trim() !== "")) return undefined;
  return stored;
}

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
    const notApplicable = notApplicableAnswer(input, existing.notApplicableReason);
    // A field the caller did not send keeps what is stored; an empty string clears it.
    existing.edit({
      periodAchievement: notApplicable ? "" : input.periodAchievement,
      cumulativeAchievement: notApplicable ? "" : input.cumulativeAchievement,
      notApplicableReason: notApplicable,
      ...(input.comments !== undefined ? { comments: input.comments.trim() || undefined } : {}),
      ...(input.dataSource !== undefined ? { dataSource: input.dataSource.trim() || undefined } : {}),
      ...(notApplicable ? { disaggregation: [] } : input.disaggregation ? { disaggregation: input.disaggregation } : {}),
    });
    const saved = await repo.update(existing);
    if (!saved.ok) return saved;
    return { ok: true, value: { id: existing.id, created: false, changed: true, previousValue } };
  }

  const id = ids.generate();
  const notApplicable = notApplicableAnswer(input, undefined);
  const update = IndicatorUpdate.create({
    id,
    tenantId: tenantId.toString(),
    indicatorId: input.indicatorId,
    reportingPeriodId,
    periodAchievement: notApplicable ? "" : input.periodAchievement,
    cumulativeAchievement: notApplicable ? "" : input.cumulativeAchievement,
    comments: input.comments,
    dataSource: input.dataSource,
    disaggregation: notApplicable ? [] : input.disaggregation,
    notApplicableReason: notApplicable,
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
