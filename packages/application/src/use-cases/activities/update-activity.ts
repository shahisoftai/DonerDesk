import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ActivityLinkResolver } from "../../services/activity-link-resolver.js";
import { toActivityUpdateDto, type ActivityUpdateDto } from "./dto.js";

export interface UpdateActivityInput {
  activityId: string;
  patch?: {
    summary?: string;
    achievements?: string;
    challenges?: string;
    lessonsLearned?: string;
    nextSteps?: string;
    location?: string;
    indicatorId?: string;
    outputId?: string;
    logframeActivityId?: string;
  };
  attachEvidenceIds?: string[];
  detachEvidenceIds?: string[];
}

export class UpdateActivityHandler {
  constructor(
    private readonly activityRepo: IActivityUpdateRepository,
    private readonly evidenceRepo: IEvidenceRepository,
    private readonly audit: IAuditLogger,
    private readonly links?: ActivityLinkResolver,
  ) {}

  async handle(ctx: AuthenticatedContext, input: UpdateActivityInput): Promise<Result<ActivityUpdateDto, DomainError>> {
    const activityResult = await this.activityRepo.findById(input.activityId, ctx.tenant.tenantId);
    if (!activityResult.ok) return activityResult;
    if (!activityResult.value) {
      return { ok: false, error: DomainError.notFound("ActivityUpdate", input.activityId) };
    }
    const activity = activityResult.value;

    if (input.patch) {
      const patch = { ...input.patch };
      if (this.links && (patch.logframeActivityId !== undefined || patch.outputId !== undefined)) {
        // Changing either end re-checks the pair, so an activity can never point at a node under another output.
        const link = await this.links.resolve(ctx, activity.projectId, {
          logframeActivityId: patch.logframeActivityId ?? activity.logframeActivityId,
          outputId: patch.outputId ?? (patch.logframeActivityId !== undefined ? undefined : activity.outputId),
        });
        if (!link.ok) return link;
        patch.logframeActivityId = link.value.logframeActivityId;
        patch.outputId = link.value.outputId;
      }
      activity.edit(patch);
    }

    if (input.attachEvidenceIds && input.attachEvidenceIds.length > 0) {
      for (const evidenceId of input.attachEvidenceIds) {
        const evidenceResult = await this.evidenceRepo.findById(evidenceId, ctx.tenant.tenantId);
        if (evidenceResult.ok && evidenceResult.value) {
          activity.attachEvidence(evidenceId);
          const evidence = evidenceResult.value;
          if (evidence.activityId !== input.activityId) {
            evidence.updateMetadata({ activityId: input.activityId });
            await this.evidenceRepo.update(evidence);
          }
        }
      }
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "activity.evidence_attached",
        entityType: "activity_update",
        entityId: input.activityId,
        projectId: activity.projectId,
        systemNote: `Attached evidence: ${input.attachEvidenceIds.join(", ")}`,
      });
    }

    if (input.detachEvidenceIds && input.detachEvidenceIds.length > 0) {
      for (const evidenceId of input.detachEvidenceIds) {
        activity.detachEvidence(evidenceId);
        const evidenceResult = await this.evidenceRepo.findById(evidenceId, ctx.tenant.tenantId);
        if (evidenceResult.ok && evidenceResult.value) {
          const evidence = evidenceResult.value;
          if (evidence.activityId === input.activityId) {
            evidence.updateMetadata({ activityId: undefined });
            await this.evidenceRepo.update(evidence);
          }
        }
      }
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "activity.evidence_detached",
        entityType: "activity_update",
        entityId: input.activityId,
        projectId: activity.projectId,
        systemNote: `Detached evidence: ${input.detachEvidenceIds.join(", ")}`,
      });
    }

    const updateResult = await this.activityRepo.update(activity);
    if (!updateResult.ok) return updateResult;

    return { ok: true, value: toActivityUpdateDto(updateResult.value) };
  }
}
