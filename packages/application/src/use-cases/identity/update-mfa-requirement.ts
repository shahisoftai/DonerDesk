import { DomainError, Permissions, mfaRequiredFrom, type Result, type Role } from "@donordesk/domain";
import type { UpdateMfaRequirementInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { IOrganizationRepository, IUserRepository } from "../../ports/identity.js";

/**
 * Requires two-step sign-in of everyone in the organisation, from a day the administrator chooses (Phase 33.12). The administrator must
 * have it on themselves first, so turning the requirement on can never lock them out. Under single sign-on the identity provider owns
 * two-step sign-in and this setting is refused. Every change is audited.
 */
export class UpdateMfaRequirementHandler {
  constructor(
    private readonly orgs: IOrganizationRepository,
    private readonly users: IUserRepository,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
    private readonly ssoManaged: boolean,
  ) {}

  async handle(ctx: AuthenticatedContext, input: UpdateMfaRequirementInput): Promise<Result<{ requiredFrom: string | null }, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "org.manage")) return { ok: false, error: DomainError.forbidden("Only an administrator can change this") };
    if (this.ssoManaged) return { ok: false, error: DomainError.conflict("Two-step sign-in is managed by your organization's single sign-on, so it cannot be required here.") };
    const orgResult = await this.orgs.findByTenant(ctx.tenant.tenantId);
    if (!orgResult.ok) return orgResult;
    if (!orgResult.value) return { ok: false, error: DomainError.notFound("Organization", ctx.tenant.tenantId.toString()) };
    const org = orgResult.value;

    if (input.required) {
      const me = await this.users.findById(ctx.tenant.userId, ctx.tenant.tenantId);
      if (!me.ok) return me;
      if (!me.value?.mfaEnabled) return { ok: false, error: DomainError.conflict("Turn on two-step sign-in for your own account first, so you cannot be locked out when it becomes required.") };
    }
    const before = org.mfaRequiredFrom;
    const from = input.required ? mfaRequiredFrom(this.clock.now(), input.graceDays) : null;
    org.setMfaRequiredFrom(from);
    const saved = await this.orgs.update(org);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: input.required ? "organization.mfa_required" : "organization.mfa_optional", entityType: "organization", entityId: org.id,
      oldValue: before ? before.toISOString() : "optional", newValue: from ? from.toISOString() : "optional",
    });
    return { ok: true, value: { requiredFrom: from ? from.toISOString() : null } };
  }
}
