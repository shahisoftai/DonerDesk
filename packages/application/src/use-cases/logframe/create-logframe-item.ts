import type { Result } from "@donordesk/domain";
import { DomainError, LogframeItem } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILogframeRepository } from "../../ports/logframe.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { CreateLogframeItemInput } from "@donordesk/contracts";

export class CreateLogframeItemHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: ILogframeRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: CreateLogframeItemInput): Promise<Result<{ id: string }, DomainError>> {
    const id = this.ids.generate();
    const item = LogframeItem.create({
      id,
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: input.projectId,
      parentId: input.parentId,
      level: input.level,
      code: input.code,
      title: input.title,
      description: input.description,
    });
    const saved = await this.repo.create(item);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.item.created",
      entityType: "logframe_item",
      entityId: id,
      projectId: input.projectId,
      newValue: input.title,
    });
    return { ok: true, value: { id } };
  }
}
