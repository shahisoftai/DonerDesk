import type { Result, EvidenceFile, IndicatorUpdate, ActivityUpdate } from "@donordesk/domain";
import { DomainError, resolveEvidencePeriod } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IEvidenceRepository } from "../ports/evidence.js";
import type { IActivityUpdateRepository } from "../ports/activities.js";
import type { IIndicatorUpdateRepository } from "../ports/logframe.js";
import type { IAuditLogger } from "../ports/core.js";
import type { IEvidenceLinker, IndicatorLinkOutcome } from "../ports/evidence-linker.js";

const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });

export class EvidenceLinkService implements IEvidenceLinker {
  constructor(
    private readonly evidence: IEvidenceRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly indicatorUpdates: IIndicatorUpdateRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async attachToActivity(ctx: AuthenticatedContext, evidenceId: string, activityId: string): Promise<Result<void, DomainError>> {
    const ev = await this.load(ctx, evidenceId);
    if (!ev.ok) return ev;
    const act = await this.activities.findById(activityId, ctx.tenant.tenantId);
    if (!act.ok) return act;
    if (!act.value) return { ok: false, error: DomainError.notFound("ActivityUpdate", activityId) };
    return this.linkActivity(ctx, ev.value, act.value);
  }

  private async linkActivity(ctx: AuthenticatedContext, evidence: EvidenceFile, activity: ActivityUpdate): Promise<Result<void, DomainError>> {
    if (!activity.attachedEvidenceIds.includes(evidence.id)) {
      activity.attachEvidence(evidence.id);
      const saved = await this.activities.update(activity);
      if (!saved.ok) return saved;
    }
    // A file inherits the period of the activity it documents unless one was given explicitly.
    const period = resolveEvidencePeriod(evidence.reportingPeriodId, activity.reportingPeriodId);
    const derivePeriod = period.source === "activity";
    if (evidence.activityId !== activity.id || derivePeriod) {
      evidence.updateMetadata({ activityId: activity.id, ...(derivePeriod ? { reportingPeriodId: period.periodId } : {}) });
      const saved = await this.evidence.update(evidence);
      if (!saved.ok) return saved;
    }
    if (derivePeriod) {
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "evidence.period_derived",
        entityType: "evidence_file",
        entityId: evidence.id,
        projectId: evidence.projectId,
        systemNote: `Period ${period.periodId} taken from activity ${activity.id}`,
      });
    }
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "evidence.attached_to_activity",
      entityType: "evidence_file",
      entityId: evidence.id,
      projectId: evidence.projectId,
      systemNote: `Attached to activity: ${activity.id}`,
    });
    return ok(undefined);
  }

  async detachFromActivity(ctx: AuthenticatedContext, evidenceId: string, activityId: string): Promise<Result<void, DomainError>> {
    const ev = await this.load(ctx, evidenceId);
    if (!ev.ok) return ev;
    const act = await this.activities.findById(activityId, ctx.tenant.tenantId);
    if (!act.ok) return act;
    if (!act.value) return { ok: false, error: DomainError.notFound("ActivityUpdate", activityId) };
    if (act.value.attachedEvidenceIds.includes(evidenceId)) {
      act.value.detachEvidence(evidenceId);
      const saved = await this.activities.update(act.value);
      if (!saved.ok) return saved;
    }
    if (ev.value.activityId === activityId) {
      ev.value.updateMetadata({ activityId: undefined });
      const saved = await this.evidence.update(ev.value);
      if (!saved.ok) return saved;
    }
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "evidence.detached_from_activity",
      entityType: "evidence_file",
      entityId: evidenceId,
      projectId: ev.value.projectId,
      systemNote: `Detached from activity: ${activityId}`,
    });
    return ok(undefined);
  }

  async attachToIndicator(ctx: AuthenticatedContext, evidenceId: string, target: string): Promise<Result<void, DomainError>> {
    const ev = await this.load(ctx, evidenceId);
    if (!ev.ok) return ev;
    const update = await this.resolveUpdate(ctx, ev.value, target);
    if (!update.ok) return update;
    if (!update.value) return { ok: false, error: DomainError.notFound("IndicatorUpdate", target) };
    return this.linkIndicator(ctx, ev.value, update.value);
  }

  private async linkIndicator(ctx: AuthenticatedContext, evidence: EvidenceFile, update: IndicatorUpdate): Promise<Result<void, DomainError>> {
    if (!update.attachedEvidenceIds.includes(evidence.id)) {
      update.attachEvidence(evidence.id);
      const saved = await this.indicatorUpdates.update(update);
      if (!saved.ok) return saved;
    }
    if (evidence.indicatorUpdateId !== update.id || evidence.indicatorId !== update.indicatorId) {
      evidence.updateMetadata({ indicatorUpdateId: update.id, indicatorId: update.indicatorId });
      const saved = await this.evidence.update(evidence);
      if (!saved.ok) return saved;
    }
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "evidence.attached_to_indicator",
      entityType: "evidence_file",
      entityId: evidence.id,
      projectId: evidence.projectId,
      systemNote: `Attached to indicator update: ${update.id}`,
    });
    return ok(undefined);
  }

  async detachFromIndicator(ctx: AuthenticatedContext, evidenceId: string, target: string): Promise<Result<void, DomainError>> {
    const ev = await this.load(ctx, evidenceId);
    if (!ev.ok) return ev;
    const update = await this.resolveUpdate(ctx, ev.value, target);
    if (!update.ok) return update;
    if (!update.value) return { ok: false, error: DomainError.notFound("IndicatorUpdate", target) };
    if (update.value.attachedEvidenceIds.includes(evidenceId)) {
      update.value.detachEvidence(evidenceId);
      const saved = await this.indicatorUpdates.update(update.value);
      if (!saved.ok) return saved;
    }
    if (ev.value.indicatorUpdateId === update.value.id) {
      // The file stays tagged to its indicator; only the proof link to this period's value goes.
      ev.value.updateMetadata({ indicatorUpdateId: undefined });
      const saved = await this.evidence.update(ev.value);
      if (!saved.ok) return saved;
    }
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "evidence.detached_from_indicator",
      entityType: "evidence_file",
      entityId: evidenceId,
      projectId: ev.value.projectId,
      systemNote: `Detached from indicator update: ${update.value.id}`,
    });
    return ok(undefined);
  }

  async linkOnUpload(ctx: AuthenticatedContext, evidence: EvidenceFile): Promise<Result<{ indicator: IndicatorLinkOutcome; activity: boolean }, DomainError>> {
    let activity = false;
    if (evidence.activityId) {
      const act = await this.activities.findById(evidence.activityId, ctx.tenant.tenantId);
      if (!act.ok) return act;
      if (act.value) {
        const linked = await this.linkActivity(ctx, evidence, act.value);
        if (!linked.ok) return linked;
        activity = true;
      }
    }
    let indicator: IndicatorLinkOutcome = "NONE";
    if (evidence.indicatorId) {
      indicator = "PENDING";
      if (evidence.reportingPeriodId) {
        const update = await this.indicatorUpdates.findByIndicatorAndPeriod(evidence.indicatorId, evidence.reportingPeriodId, ctx.tenant.tenantId);
        if (!update.ok) return update;
        if (update.value) {
          const linked = await this.linkIndicator(ctx, evidence, update.value);
          if (!linked.ok) return linked;
          indicator = "ATTACHED";
        }
      }
    }
    return ok({ indicator, activity });
  }

  async attachPendingFor(ctx: AuthenticatedContext, update: IndicatorUpdate): Promise<Result<number, DomainError>> {
    const tagged = await this.evidence.search(
      { indicatorId: update.indicatorId, reportingPeriodId: update.reportingPeriodId, pageSize: 200 },
      ctx.tenant.tenantId,
    );
    if (!tagged.ok) return tagged;
    let attached = 0;
    for (const file of tagged.value.items) {
      if (file.indicatorUpdateId) continue;
      const linked = await this.linkIndicator(ctx, file, update);
      if (!linked.ok) return linked;
      attached += 1;
    }
    return ok(attached);
  }

  private async load(ctx: AuthenticatedContext, evidenceId: string): Promise<Result<EvidenceFile, DomainError>> {
    const found = await this.evidence.findById(evidenceId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("EvidenceFile", evidenceId) };
    return ok(found.value);
  }

  /** `target` is normally an indicator-update id; an indicator id resolves through the file's reporting period (legacy callers pass either). */
  private async resolveUpdate(ctx: AuthenticatedContext, evidence: EvidenceFile, target: string): Promise<Result<IndicatorUpdate | null, DomainError>> {
    const direct = await this.indicatorUpdates.findById(target, ctx.tenant.tenantId);
    if (!direct.ok) return direct;
    if (direct.value) return ok(direct.value);
    if (evidence.reportingPeriodId) return this.indicatorUpdates.findByIndicatorAndPeriod(target, evidence.reportingPeriodId, ctx.tenant.tenantId);
    return ok(null);
  }
}
