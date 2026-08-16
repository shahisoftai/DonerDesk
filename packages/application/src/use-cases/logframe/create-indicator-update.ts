import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { CreateIndicatorUpdateInput } from "@donordesk/contracts";
import { upsertIndicatorUpdate } from "./upsert-indicator-update.js";

export class CreateIndicatorUpdateHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IIndicatorUpdateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: CreateIndicatorUpdateInput): Promise<Result<{ id: string }, DomainError>> {
    const saved = await upsertIndicatorUpdate(this.ids, this.repo, ctx.tenant.tenantId, ctx.tenant.userId, input.reportingPeriodId, input);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.indicator.updated",
      entityType: "indicator_update",
      entityId: saved.value.id,
      newValue: input.periodAchievement,
    });
    return { ok: true, value: { id: saved.value.id } };
  }
}
