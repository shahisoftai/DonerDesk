import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { UpdateOrganizationReportingDefaultsInput } from "@donordesk/contracts";

/** Updates the account-wide default reporting profile used to seed new projects. */
export class UpdateOrganizationReportingDefaultsHandler {
  constructor(private readonly orgs: IOrganizationRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: UpdateOrganizationReportingDefaultsInput): Promise<Result<void, DomainError>> {
    const result = await this.orgs.findByTenant(ctx.tenant.tenantId);
    if (!result.ok) return result;
    if (!result.value) return { ok: false, error: DomainError.notFound("Organization", ctx.tenant.tenantId.toString()) };
    const org = result.value;
    org.updateReportingDefaults(input.reportingDefaults);
    if (input.language) org.updateProfile({ defaultLanguage: input.language });
    const saved = await this.orgs.update(org);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "identity.organization.reporting_defaults_updated",
      entityType: "organization",
      entityId: org.id,
      newValue: JSON.stringify({ reportingDefaults: org.reportingDefaults }),
    });
    return { ok: true, value: undefined };
  }
}
