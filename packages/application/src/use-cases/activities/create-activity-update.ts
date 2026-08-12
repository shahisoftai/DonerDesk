import type { Result } from "@donordesk/domain";
import { DomainError, ActivityUpdate } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { CreateActivityUpdateInput } from "@donordesk/contracts";

export class CreateActivityUpdateHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IActivityUpdateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: CreateActivityUpdateInput): Promise<Result<{ id: string }, DomainError>> {
    const id = this.ids.generate();
    const a = ActivityUpdate.create({
      id,
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: input.projectId,
      reportingPeriodId: input.reportingPeriodId,
      activityTitle: input.activityTitle,
      activityDate: new Date(input.activityDate),
      location: input.location,
      outputId: input.outputId,
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
    return { ok: true, value: { id } };
  }
}
