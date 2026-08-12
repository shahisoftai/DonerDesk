import type { Result } from "@donordesk/domain";
import { DomainError, Indicator } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { CreateIndicatorInput } from "@donordesk/contracts";

export class CreateIndicatorHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IIndicatorRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: CreateIndicatorInput): Promise<Result<{ id: string }, DomainError>> {
    const id = this.ids.generate();
    const ind = Indicator.create({
      id,
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: input.projectId,
      logframeItemId: input.logframeItemId,
      code: input.code,
      name: input.name,
      type: input.type,
      baseline: input.baseline,
      target: input.target,
      unit: input.unit,
      meansOfVerification: input.meansOfVerification,
      dataSource: input.dataSource,
      frequency: input.frequency,
      responsibleUserId: input.responsibleUserId,
      disaggregationRequired: input.disaggregationRequired,
    });
    const saved = await this.repo.create(ind);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.indicator.created",
      entityType: "indicator",
      entityId: id,
      projectId: input.projectId,
      newValue: input.code,
    });
    return { ok: true, value: { id } };
  }
}
