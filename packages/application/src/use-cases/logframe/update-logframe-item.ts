import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILogframeRepository } from "../../ports/logframe.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { UpdateLogframeItemInput } from "@donordesk/contracts";

/**
 * Corrects the words of a result: its title, description, assumptions and rationale. Its place in the framework changes by a
 * move, never here, and an edit after approval is allowed: the version history records it as a change to the results.
 */
export class UpdateLogframeItemHandler {
  constructor(private readonly items: ILogframeRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: UpdateLogframeItemInput): Promise<Result<{ id: string }, DomainError>> {
    const found = await this.items.findById(itemId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const item = found.value;
    if (!item) return { ok: false, error: DomainError.notFound("LogframeItem", itemId) };

    const before = JSON.stringify({ title: item.title, description: item.description, assumptions: item.assumptions, rationale: item.rationale });
    try {
      item.edit(input);
    } catch (err) {
      if (err instanceof DomainError) return { ok: false, error: err };
      throw err;
    }
    const after = JSON.stringify({ title: item.title, description: item.description, assumptions: item.assumptions, rationale: item.rationale });
    if (before === after) return { ok: true, value: { id: item.id } };

    const saved = await this.items.update(item);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.item.updated",
      entityType: "logframe_item",
      entityId: item.id,
      projectId: item.projectId,
      oldValue: before,
      newValue: after,
    });
    return { ok: true, value: { id: item.id } };
  }
}
