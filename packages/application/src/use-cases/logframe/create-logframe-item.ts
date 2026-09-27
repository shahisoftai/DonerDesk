import type { Result } from "@donordesk/domain";
import { DomainError, LogframeItem, planLogframeMove } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILogframeRepository } from "../../ports/logframe.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { CreateLogframeItemInput } from "@donordesk/contracts";

export class CreateLogframeItemHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: ILogframeRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: CreateLogframeItemInput): Promise<Result<{ id: string }, DomainError>> {
    const id = this.ids.generate();
    let item: LogframeItem;
    try {
      item = LogframeItem.create({
        id,
        tenantId: ctx.tenant.tenantId.toString(),
        projectId: input.projectId,
        level: input.level,
        code: input.code,
        title: input.title,
        description: input.description,
      });
    } catch (err) {
      if (err instanceof DomainError) return { ok: false, error: err };
      throw err;
    }

    const existing = await this.repo.findByProject(input.projectId, ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    // Appends the new item after its siblings, applying the same parent/level rules as a move.
    const placed = planLogframeMove([...existing.value, item], { itemId: id, parentId: input.parentId ?? null, index: Number.MAX_SAFE_INTEGER });
    if (!placed.ok) return placed;

    const saved = await this.repo.create(item);
    if (!saved.ok) return saved;
    const renumbered = await this.repo.savePositions(placed.value.filter((other) => other.id !== id));
    if (!renumbered.ok) return renumbered;
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
