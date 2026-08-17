import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IAuditLogger } from "../../ports/core.js";

export class DeleteTemplateHandler {
  constructor(private readonly templates: IDonorTemplateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, templateId: string): Promise<Result<void, DomainError>> {
    const r = await this.templates.findById(templateId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("DonorTemplate", templateId) };
    const template = r.value;

    const deleted = await this.templates.delete(templateId, ctx.tenant.tenantId);
    if (!deleted.ok) return deleted;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "template.deleted",
      entityType: "donor_template",
      entityId: templateId,
      projectId: template.projectId,
      newValue: template.templateName,
    });
    return { ok: true, value: undefined };
  }
}
