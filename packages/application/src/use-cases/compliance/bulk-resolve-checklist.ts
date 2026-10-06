import type { Result } from "@donordesk/domain";
import { DomainError, isAttestation, canBulkAttest } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IChecklistRepository } from "../../ports/compliance.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { BulkResolveChecklistInput } from "@donordesk/contracts";

/**
 * Applies a single decision to several checklist items in one call, with a
 * shared resolution note. Each item is tenant-scoped before mutation, and every
 * mutation is audited individually so the audit trail stays item-granular.
 */
export class BulkResolveChecklistHandler {
  constructor(
    private readonly repo: IChecklistRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: BulkResolveChecklistInput): Promise<Result<{ resolved: number; skipped: number; notPermitted: number }, DomainError>> {
    let resolved = 0;
    let skipped = 0;
    // Attestations (sign-off, sensitive data, procurement...) are a person's statement: only an administrator or a project
    // manager may attest in bulk; everyone else decides them one by one.
    let notPermitted = 0;

    for (const itemId of input.itemIds) {
      const r = await this.repo.findById(itemId, ctx.tenant.tenantId);
      if (!r.ok) return r;
      if (!r.value) {
        skipped++;
        continue;
      }
      const item = r.value;
      const decides = input.decision === "RESOLVE" || input.decision === "ACCEPT_RISK" || input.decision === "NOT_APPLICABLE";
      if (decides && isAttestation(item.type)) {
        if (!canBulkAttest(ctx.tenant.role)) {
          notPermitted++;
          continue;
        }
        item.recordAttestation(ctx.tenant.userId);
      }
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
        eventType: `compliance.checklist.${input.decision.toLowerCase()}.bulk`,
        entityType: "checklist_item",
        entityId: itemId,
        projectId: item.projectId,
        newValue: input.notes,
      });
      resolved++;
    }

    return { ok: true, value: { resolved, skipped, notPermitted } };
  }
}
