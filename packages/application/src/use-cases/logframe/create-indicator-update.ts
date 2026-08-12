import type { Result } from "@donordesk/domain";
import { DomainError, IndicatorUpdate } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { CreateIndicatorUpdateInput } from "@donordesk/contracts";

export class CreateIndicatorUpdateHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IIndicatorUpdateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: CreateIndicatorUpdateInput): Promise<Result<{ id: string }, DomainError>> {
    const id = this.ids.generate();
    const upd = IndicatorUpdate.create({
      id,
      tenantId: ctx.tenant.tenantId.toString(),
      indicatorId: input.indicatorId,
      reportingPeriodId: input.reportingPeriodId,
      periodAchievement: input.periodAchievement,
      cumulativeAchievement: input.cumulativeAchievement,
      comments: input.comments,
      dataSource: input.dataSource,
      attachedEvidenceIds: input.attachedEvidenceIds,
      createdById: ctx.tenant.userId,
    });
    const saved = await this.repo.create(upd);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.indicator.updated",
      entityType: "indicator_update",
      entityId: id,
      newValue: input.periodAchievement,
    });
    return { ok: true, value: { id } };
  }
}
