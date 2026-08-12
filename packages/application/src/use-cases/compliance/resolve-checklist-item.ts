import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IChecklistRepository } from "../../ports/compliance.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface ResolveChecklistInput {
  decision: "RESOLVE" | "ACCEPT_RISK" | "NOT_APPLICABLE" | "START";
  notes?: string;
}

export class ResolveChecklistItemHandler {
  constructor(private readonly repo: IChecklistRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: ResolveChecklistInput): Promise<Result<void, DomainError>> {
    const r = await this.repo.findById(itemId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ChecklistItem", itemId) };
    const item = r.value;
    switch (input.decision) {
      case "RESOLVE":
        item.resolve(input.notes);
        break;
      case "ACCEPT_RISK":
        item.acceptRisk(input.notes);
        break;
      case "NOT_APPLICABLE":
        item.markNotApplicable(input.notes);
        break;
      case "START":
        item.start();
        break;
    }
    const saved = await this.repo.update(item);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: `compliance.checklist.${input.decision.toLowerCase()}`,
      entityType: "checklist_item",
      entityId: itemId,
    });
    return { ok: true, value: undefined };
  }
}
