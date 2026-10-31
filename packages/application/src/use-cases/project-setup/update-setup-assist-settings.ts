import type { Role, Result } from "@donordesk/domain";
import { DomainError, Permissions } from "@donordesk/domain";
import type { SetupAssistSettingsInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IOrganizationRepository } from "../../ports/identity.js";

/**
 * The organisation's opt-in for the project setup assistant (Phase 36). Off in every organisation until an administrator
 * turns it on; while it is off nothing is read, redacted or sent.
 */
export class UpdateSetupAssistSettingsHandler {
  constructor(private readonly orgs: IOrganizationRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: SetupAssistSettingsInput): Promise<Result<void, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "org.manage")) {
      return { ok: false, error: DomainError.forbidden("Only an administrator can change setup assistance") };
    }
    const result = await this.orgs.findByTenant(ctx.tenant.tenantId);
    if (!result.ok) return result;
    if (!result.value) return { ok: false, error: DomainError.notFound("Organization", ctx.tenant.tenantId.toString()) };
    const org = result.value;
    const before = org.setupAssistEnabled;
    org.updateSetupAssistSettings({ enabled: input.enabled });
    const saved = await this.orgs.update(org);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "organization.setup_assist_updated",
      entityType: "organization", entityId: org.id,
      oldValue: String(before), newValue: String(input.enabled),
    });
    return { ok: true, value: undefined };
  }
}
