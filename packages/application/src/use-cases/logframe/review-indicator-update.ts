import type { IndicatorUpdate, Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface IndicatorUpdateReview {
  eventType: string;
  apply(update: IndicatorUpdate, reviewerId: string): void;
  systemNote?: string;
}

/** Shared load → transition → save → audit flow for reviewer decisions on an indicator update. */
export async function reviewIndicatorUpdate(
  deps: { repo: IIndicatorUpdateRepository; audit: IAuditLogger },
  ctx: AuthenticatedContext,
  indicatorUpdateId: string,
  review: IndicatorUpdateReview,
): Promise<Result<void, DomainError>> {
  const found = await deps.repo.findById(indicatorUpdateId, ctx.tenant.tenantId);
  if (!found.ok) return found;
  if (!found.value) return { ok: false, error: DomainError.notFound("IndicatorUpdate", indicatorUpdateId) };
  const update = found.value;
  const oldStatus = update.verificationStatus;
  try {
    review.apply(update, ctx.tenant.userId);
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err };
    throw err;
  }
  const saved = await deps.repo.update(update);
  if (!saved.ok) return saved;
  await deps.audit.record({
    tenantId: ctx.tenant.tenantId,
    actorId: ctx.tenant.userId,
    eventType: review.eventType,
    entityType: "indicator_update",
    entityId: indicatorUpdateId,
    oldValue: oldStatus,
    newValue: update.verificationStatus,
    systemNote: review.systemNote,
  });
  return { ok: true, value: undefined };
}
