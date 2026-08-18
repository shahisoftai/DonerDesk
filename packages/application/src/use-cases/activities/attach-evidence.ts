import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface AttachEvidenceInput {
  evidenceId: string;
  activityId?: string;
  indicatorId?: string;
}

export class AttachEvidenceHandler {
  constructor(
    private readonly evidenceRepo: IEvidenceRepository,
    private readonly activityRepo: IActivityUpdateRepository,
    private readonly indicatorUpdateRepo: IIndicatorUpdateRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: AttachEvidenceInput): Promise<Result<void, DomainError>> {
    if (!input.activityId && !input.indicatorId) {
      return { ok: false, error: DomainError.validation("Either activityId or indicatorId must be provided") };
    }

    const evidenceResult = await this.evidenceRepo.findById(input.evidenceId, ctx.tenant.tenantId);
    if (!evidenceResult.ok) return evidenceResult;
    if (!evidenceResult.value) {
      return { ok: false, error: DomainError.notFound("EvidenceFile", input.evidenceId) };
    }
    const evidence = evidenceResult.value;

    if (input.activityId) {
      const activityResult = await this.activityRepo.findById(input.activityId, ctx.tenant.tenantId);
      if (!activityResult.ok) return activityResult;
      if (!activityResult.value) {
        return { ok: false, error: DomainError.notFound("ActivityUpdate", input.activityId) };
      }
      const activity = activityResult.value;

      if (!activity.attachedEvidenceIds.includes(input.evidenceId)) {
        activity.attachEvidence(input.evidenceId);
        const updateResult = await this.activityRepo.update(activity);
        if (!updateResult.ok) return updateResult;
      }

      if (evidence.activityId !== input.activityId) {
        evidence.updateMetadata({ activityId: input.activityId });
        const evidenceUpdateResult = await this.evidenceRepo.update(evidence);
        if (!evidenceUpdateResult.ok) return evidenceUpdateResult;
      }

      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "evidence.attached_to_activity",
        entityType: "evidence_file",
        entityId: input.evidenceId,
        projectId: evidence.projectId,
        systemNote: `Attached to activity: ${input.activityId}`,
      });
    }

    if (input.indicatorId) {
      const indicatorResult = await this.indicatorUpdateRepo.findById(input.indicatorId, ctx.tenant.tenantId);
      if (!indicatorResult.ok) return indicatorResult;
      if (!indicatorResult.value) {
        return { ok: false, error: DomainError.notFound("IndicatorUpdate", input.indicatorId) };
      }
      const indicatorUpdate = indicatorResult.value;

      if (!indicatorUpdate.attachedEvidenceIds.includes(input.evidenceId)) {
        indicatorUpdate.attachEvidence(input.evidenceId);
        const updateResult = await this.indicatorUpdateRepo.update(indicatorUpdate);
        if (!updateResult.ok) return updateResult;
      }

      if (evidence.indicatorId !== input.indicatorId) {
        evidence.updateMetadata({ indicatorId: input.indicatorId });
        const evidenceUpdateResult = await this.evidenceRepo.update(evidence);
        if (!evidenceUpdateResult.ok) return evidenceUpdateResult;
      }

      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "evidence.attached_to_indicator",
        entityType: "evidence_file",
        entityId: input.evidenceId,
        systemNote: `Attached to indicator: ${input.indicatorId}`,
      });
    }

    return { ok: true, value: undefined };
  }
}
