import type { PackInput, Result } from "@donordesk/domain";
import { DomainError, Permissions, checkPackInput, describePackProblem, packKey, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ISetupPackRepository } from "../../ports/project-setup.js";

/**
 * Saves the organisation's pack for a sector (Settings). One check (`checkPackInput`) decides what is allowed; a pack holds no
 * people and no donor, so saving one cannot expose anything. Audited; `org.manage` only.
 */
export class SaveOrganisationPackHandler {
  constructor(private readonly packs: ISetupPackRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: PackInput): Promise<Result<void, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "org.manage")) return { ok: false, error: DomainError.forbidden("Only an administrator can manage default packs") };
    const checked = checkPackInput(input);
    if (!checked.ok) return { ok: false, error: DomainError.validation(checked.problems.map(describePackProblem).join(" "), { problems: checked.problems }) };
    const key = packKey(checked.pack.sector);
    const saved = await this.packs.save(ctx.tenant.tenantId, key, checked.pack, ctx.tenant.userId);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "setup.pack_saved", entityType: "setup_default_pack", entityId: key, newValue: checked.pack.label });
    return { ok: true, value: undefined };
  }
}
