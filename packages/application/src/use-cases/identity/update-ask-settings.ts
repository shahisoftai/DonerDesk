import { DomainError, Permissions, type Result, type Role } from "@donordesk/domain";
import type { UpdateAskSettingsInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IOrganizationRepository } from "../../ports/identity.js";

/**
 * The administrator's opt-in for Ask DonorDesk (Phase 33.9). Turning it on lets people in the organisation put questions to the
 * organisation's own records; the question and the records it needs are sent to the AI provider (with personal details redacted).
 * Off for every organisation until someone with `org.manage` turns it on; every change is audited.
 */
export class UpdateAskSettingsHandler {
  constructor(private readonly orgs: IOrganizationRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: UpdateAskSettingsInput): Promise<Result<void, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "org.manage")) return { ok: false, error: DomainError.forbidden("Only an administrator can change Ask DonorDesk") };
    const result = await this.orgs.findByTenant(ctx.tenant.tenantId);
    if (!result.ok) return result;
    if (!result.value) return { ok: false, error: DomainError.notFound("Organization", ctx.tenant.tenantId.toString()) };
    const org = result.value;
    const before = org.askEnabled;
    org.updateAskSettings({ enabled: input.enabled });
    const saved = await this.orgs.update(org);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "organization.ask_settings_updated", entityType: "organization", entityId: org.id,
      oldValue: String(before), newValue: String(input.enabled),
    });
    return { ok: true, value: undefined };
  }
}
