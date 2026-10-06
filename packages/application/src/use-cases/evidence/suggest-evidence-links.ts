import type { Result, TenantId } from "@donordesk/domain";
import { DomainError, suggestEvidenceLinks } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";

const MAX_SUGGESTIONS = 5;

export interface EvidenceLinkSuggestion {
  evidenceId: string;
  targetType: "activity" | "indicator";
  /** ActivityUpdate id for "activity", IndicatorUpdate id for "indicator" - matches AttachEvidenceInput's activityId/indicatorId shape. */
  targetId: string;
  targetLabel: string;
  score: number;
  /** Why it is suggested, in words ("same activity node in the logframe"). */
  reason: string;
}

/**


/**
 * Suggests, but never applies, links between an evidence file and the
 * project's activities/indicator updates by title similarity. Generalizes
 * the keyword matcher that was previously hardcoded per-demo-project in
 * seed-eerp-evidence-activities.ts into a real, reusable suggestion service.
 * Confirmation always goes through AttachEvidenceHandler, so a suggestion
 * can never silently become an attached link.
 */
export class SuggestEvidenceLinksHandler {
  constructor(
    private readonly evidenceRepo: IEvidenceRepository,
    private readonly activityRepo: IActivityUpdateRepository,
    private readonly indicatorRepo: IIndicatorRepository,
    private readonly indicatorUpdateRepo: IIndicatorUpdateRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, evidenceId: string): Promise<Result<EvidenceLinkSuggestion[], DomainError>> {
    const evidenceResult = await this.evidenceRepo.findById(evidenceId, ctx.tenant.tenantId);
    if (!evidenceResult.ok) return evidenceResult;
    if (!evidenceResult.value) {
      return { ok: false, error: DomainError.notFound("EvidenceFile", evidenceId) };
    }
    const evidence = evidenceResult.value;

    const [activitiesResult, indicatorsResult] = await Promise.all([
      this.activityRepo.findByProject(evidence.projectId, ctx.tenant.tenantId),
      this.indicatorRepo.findByProject(evidence.projectId, ctx.tenant.tenantId),
    ]);
    if (!activitiesResult.ok) return activitiesResult;
    if (!indicatorsResult.ok) return indicatorsResult;

    const ranked = suggestEvidenceLinks({
      evidence: { title: evidence.title, fileName: evidence.fileName, notes: evidence.notes, extractedText: evidence.extractedText, activityId: evidence.activityId },
      activities: activitiesResult.value.map((a) => ({
        id: a.id,
        title: a.activityTitle,
        logframeActivityId: a.logframeActivityId,
        indicatorId: a.indicatorId,
        alreadyAttached: a.attachedEvidenceIds.includes(evidenceId),
      })),
      indicators: indicatorsResult.value.map((i) => ({ id: i.id, code: i.code, name: i.name, logframeItemId: i.logframeItemId })),
      limit: MAX_SUGGESTIONS,
    });

    // An indicator is proved through one of its period values: map the suggestion to its updates (the file's period first).
    const suggestions: EvidenceLinkSuggestion[] = [];
    for (const r of ranked) {
      if (r.targetType === "activity") {
        suggestions.push({ evidenceId, targetType: "activity", targetId: r.targetId, targetLabel: r.label, score: r.score, reason: r.reason });
        continue;
      }
      const updatesResult = await this.indicatorUpdateRepo.findByIndicator(r.targetId, ctx.tenant.tenantId as TenantId);
      if (!updatesResult.ok) continue;
      const open = updatesResult.value.filter((u) => !u.attachedEvidenceIds.includes(evidenceId));
      const inPeriod = open.filter((u) => evidence.reportingPeriodId !== undefined && u.reportingPeriodId === evidence.reportingPeriodId);
      for (const update of inPeriod.length > 0 ? inPeriod : open) {
        suggestions.push({ evidenceId, targetType: "indicator", targetId: update.id, targetLabel: r.label, score: r.score, reason: r.reason });
      }
    }

    suggestions.sort((a, b) => b.score - a.score);
    return { ok: true, value: suggestions.slice(0, MAX_SUGGESTIONS) };
  }
}
