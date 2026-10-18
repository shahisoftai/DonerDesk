import type { Result } from "@donordesk/domain";
import { DomainError, ActivityUpdate } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { ActivityLinkResolver } from "../../services/activity-link-resolver.js";
import type { PlanLinkResolver } from "../../services/plan-link-resolver.js";
import type { ITaskReconciliation } from "../../ports/tasks.js";
import type { CreateActivityUpdateInput } from "@donordesk/contracts";

export class CreateActivityUpdateHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IActivityUpdateRepository, private readonly audit: IAuditLogger, private readonly links?: ActivityLinkResolver, private readonly planLinks?: PlanLinkResolver, private readonly tasks?: ITaskReconciliation) {}

  async handle(ctx: AuthenticatedContext, input: CreateActivityUpdateInput): Promise<Result<{ id: string }, DomainError>> {
    // The planned activity may fill an empty logframe link (fill, never overwrite); the pair is then validated as before.
    const plan = this.planLinks && input.plannedActivityId
      ? await this.planLinks.resolve(ctx, input.projectId, { plannedActivityId: input.plannedActivityId, logframeActivityId: input.logframeActivityId })
      : ({ ok: true, value: { logframeActivityId: input.logframeActivityId } } as { ok: true; value: { plannedActivityId?: string; logframeActivityId?: string | undefined } });
    if (!plan.ok) return plan;
    const logframeActivityId = plan.value.logframeActivityId;
    const link = this.links
      ? await this.links.resolve(ctx, input.projectId, { logframeActivityId, outputId: input.outputId })
      : ({ ok: true, value: { outputId: input.outputId, logframeActivityId } } as const);
    if (!link.ok) return link;
    const id = this.ids.generate();
    const a = ActivityUpdate.create({
      id,
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: input.projectId,
      reportingPeriodId: input.reportingPeriodId,
      activityTitle: input.activityTitle,
      activityDate: new Date(input.activityDate),
      ...(input.activityEndDate ? { activityEndDate: new Date(input.activityEndDate) } : {}),
      location: input.location,
      outputId: link.value.outputId,
      logframeActivityId: link.value.logframeActivityId,
      ...(plan.value.plannedActivityId ? { plannedActivityId: plan.value.plannedActivityId } : {}),
      indicatorId: input.indicatorId,
      participantsTotal: input.participantsTotal,
      participantsMale: input.participantsMale,
      participantsFemale: input.participantsFemale,
      participantsChildren: input.participantsChildren,
      participantsDisability: input.participantsDisability,
      participantsOther: input.participantsOther,
      summary: input.summary,
      achievements: input.achievements,
      challenges: input.challenges,
      lessonsLearned: input.lessonsLearned,
      nextSteps: input.nextSteps,
      attachedEvidenceIds: input.attachedEvidenceIds,
      submittedById: ctx.tenant.userId,
    });
    a.submit();
    const saved = await this.repo.create(a);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "activity.submitted",
      entityType: "activity_update",
      entityId: id,
      projectId: input.projectId,
    });
    await this.tasks?.reconcileForCurrentUser(ctx);
    return { ok: true, value: { id } };
  }
}
