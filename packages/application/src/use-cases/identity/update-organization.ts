import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { OrganizationProfileInput } from "@donordesk/contracts";

export class UpdateOrganizationHandler {
  constructor(private readonly orgs: IOrganizationRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: OrganizationProfileInput): Promise<Result<void, DomainError>> {
    const result = await this.orgs.findByTenant(ctx.tenant.tenantId);
    if (!result.ok) return result;
    if (!result.value) return { ok: false, error: DomainError.notFound("Organization", ctx.tenant.tenantId.toString()) };
    const org = result.value;
    org.updateProfile({
      name: input.name,
      organizationType: input.organizationType,
      country: input.country,
      sectors: input.sectors,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      website: input.website,
      defaultLanguage: input.defaultLanguage,
      logoUrl: input.logoUrl,
      mainOfficeLocation: input.mainOfficeLocation,
      donorTypesServed: input.donorTypesServed,
      dataResidency: input.dataResidency,
      aiEnabled: input.aiEnabled,
    });
    const saved = await this.orgs.update(org);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "identity.organization.updated",
      entityType: "organization",
      entityId: org.id,
    });
    return { ok: true, value: undefined };
  }
}
