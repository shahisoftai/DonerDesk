import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";

export class ListActivitiesHandler {
  constructor(private readonly repo: IActivityUpdateRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<unknown[], DomainError>> {
    const r = await this.repo.findByProject(projectId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    return {
      ok: true,
      value: r.value.map((a) => ({
        id: a.id,
        reportingPeriodId: a.reportingPeriodId,
        activityTitle: a.activityTitle,
        activityDate: a.activityDate.toISOString(),
        location: a.location,
        outputId: a.outputId,
        indicatorId: a.indicatorId,
        participantsTotal: a.participantsTotal,
        participantsMale: a.participantsMale,
        participantsFemale: a.participantsFemale,
        participantsChildren: a.participantsChildren,
        participantsDisability: a.participantsDisability,
        summary: a.summary,
        achievements: a.achievements,
        challenges: a.challenges,
        lessonsLearned: a.lessonsLearned,
        nextSteps: a.nextSteps,
        polishedNarrative: a.polishedNarrative,
        attachedEvidenceIds: a.attachedEvidenceIds,
        status: a.status,
      })),
    };
  }
}
