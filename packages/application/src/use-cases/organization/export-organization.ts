import type { Result } from "@donordesk/domain";
import { DomainError, Permissions, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IOrganizationExporter, OrganizationExport } from "../../ports/infrastructure.js";

/**
 * Hands an administrator the whole organisation as one machine-readable bundle (records, and the evidence files when
 * asked): the "export your projects, reports and evidence at any time" the security page promises, as one download
 * instead of one report at a time. Recorded in the audit trail, because it is the largest read the product offers.
 */
export class ExportOrganizationHandler {
  constructor(private readonly exporter: IOrganizationExporter, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, options: { includeFiles: boolean }): Promise<Result<OrganizationExport, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "org.manage");
    try {
      const result = await this.exporter.export(ctx.tenant.tenantId.toString(), options);
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "organization.exported",
        entityType: "organization",
        entityId: ctx.tenant.tenantId.toString(),
        newValue: JSON.stringify({ includeFiles: options.includeFiles }),
      });
      return { ok: true, value: result };
    } catch (error) {
      if (error instanceof DomainError) return { ok: false, error };
      throw error;
    }
  }
}
