import type { Result, TenantId } from "@donordesk/domain";
import { DomainError, scoreSimilarity } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";

export interface EvidenceLinkSuggestion {
  evidenceId: string;
  targetType: "activity" | "indicator";
  /** ActivityUpdate id for "activity", IndicatorUpdate id for "indicator" — matches AttachEvidenceInput's activityId/indicatorId shape. */
  targetId: string;
  targetLabel: string;
  score: number;
}

/**
 * Below this lexical-similarity score a match is more likely coincidental
 * token overlap than a real relationship — never suggest it.
 */
const SUGGESTION_THRESHOLD = 0.2;
const MAX_SUGGESTIONS = 5;

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

    const suggestions: EvidenceLinkSuggestion[] = [];

    for (const activity of activitiesResult.value) {
      if (activity.attachedEvidenceIds.includes(evidenceId)) continue;
      const score = scoreSimilarity(evidence.title, activity.activityTitle);
      if (score >= SUGGESTION_THRESHOLD) {
        suggestions.push({
          evidenceId,
          targetType: "activity",
          targetId: activity.id,
          targetLabel: activity.activityTitle,
          score,
        });
      }
    }

    for (const indicator of indicatorsResult.value) {
      const indicatorScore = scoreSimilarity(evidence.title, `${indicator.code} ${indicator.name}`);
      if (indicatorScore < SUGGESTION_THRESHOLD) continue;

      const updatesResult = await this.indicatorUpdateRepo.findByIndicator(indicator.id, ctx.tenant.tenantId as TenantId);
      if (!updatesResult.ok) continue;
      for (const update of updatesResult.value) {
        if (update.attachedEvidenceIds.includes(evidenceId)) continue;
        suggestions.push({
          evidenceId,
          targetType: "indicator",
          targetId: update.id,
          targetLabel: `${indicator.code} — ${indicator.name}`,
          score: indicatorScore,
        });
      }
    }

    suggestions.sort((a, b) => b.score - a.score);
    return { ok: true, value: suggestions.slice(0, MAX_SUGGESTIONS) };
  }
}
