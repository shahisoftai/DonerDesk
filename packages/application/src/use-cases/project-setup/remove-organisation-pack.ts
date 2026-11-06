import type { Result } from "@donordesk/domain";
import { DomainError, Permissions, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ISetupPackRepository } from "../../ports/project-setup.js";

/** Removes the organisation's own pack for a sector, so the built-in one applies again. Audited; `org.manage` only. */
export class RemoveOrganisationPackHandler {
  constructor(private readonly packs: ISetupPackRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, sectorKey: string): Promise<Result<void, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "org.manage")) return { ok: false, error: DomainError.forbidden("Only an administrator can manage default packs") };
    const removed = await this.packs.remove(ctx.tenant.tenantId, sectorKey);
    if (!removed.ok) return removed;
    if (!removed.value) return { ok: false, error: DomainError.notFound("Default pack", sectorKey) };
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "setup.pack_removed", entityType: "setup_default_pack", entityId: sectorKey });
    return { ok: true, value: undefined };
  }
}
