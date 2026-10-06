import type { Result } from "@donordesk/domain";
import { DomainError, isAttestation } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IChecklistRepository } from "../../ports/compliance.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface ResolveChecklistInput {
  decision: "RESOLVE" | "ACCEPT_RISK" | "NOT_APPLICABLE" | "START" | "REOPEN";
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
      case "REOPEN":
        item.reopen();
        break;
    }
    // An attestation is a person's statement: the item names who made it.
    if (isAttestation(item.type) && (input.decision === "RESOLVE" || input.decision === "ACCEPT_RISK" || input.decision === "NOT_APPLICABLE")) {
      item.recordAttestation(ctx.tenant.userId);
    }
    const saved = await this.repo.update(item);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: `compliance.checklist.${input.decision.toLowerCase()}`,
      entityType: "checklist_item",
      entityId: itemId,
      projectId: item.projectId,
      newValue: input.notes,
    });
    return { ok: true, value: undefined };
  }
}
