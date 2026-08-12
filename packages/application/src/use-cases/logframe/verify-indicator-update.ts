import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IAuditLogger } from "../../ports/core.js";

export class VerifyIndicatorUpdateHandler {
  constructor(private readonly repo: IIndicatorUpdateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, indicatorUpdateId: string): Promise<Result<void, DomainError>> {
    const r = await this.repo.findById(indicatorUpdateId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("IndicatorUpdate", indicatorUpdateId) };
    const upd = r.value;
    upd.submit();
    upd.verify(ctx.tenant.userId);
    const saved = await this.repo.update(upd);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.indicator.verified",
      entityType: "indicator_update",
      entityId: indicatorUpdateId,
    });
    return { ok: true, value: undefined };
  }
}
