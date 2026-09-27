import type { Result } from "@donordesk/domain";
import { DomainError, planLogframeMove } from "@donordesk/domain";
import type { MoveLogframeItemInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { ILogframeRepository } from "../../ports/logframe.js";
import type { IAuditLogger } from "../../ports/core.js";

/** Reorders a logframe item among its siblings and/or moves it under a new parent. */
export class MoveLogframeItemHandler {
  constructor(private readonly repo: ILogframeRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: MoveLogframeItemInput): Promise<Result<void, DomainError>> {
    const found = await this.repo.findById(itemId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("LogframeItem", itemId) };
    const previousParentId = found.value.parentId ?? null;

    const all = await this.repo.findByProject(found.value.projectId, ctx.tenant.tenantId);
    if (!all.ok) return all;
    const planned = planLogframeMove(all.value, { itemId, parentId: input.parentId, index: input.index });
    if (!planned.ok) return planned;

    const saved = await this.repo.savePositions(planned.value);
    if (!saved.ok) return saved;
    if (planned.value.length > 0) {
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "logframe.item.moved",
        entityType: "logframe_item",
        entityId: itemId,
        projectId: found.value.projectId,
        oldValue: previousParentId ?? "",
        newValue: input.parentId ?? "",
      });
    }
    return { ok: true, value: undefined };
  }
}
