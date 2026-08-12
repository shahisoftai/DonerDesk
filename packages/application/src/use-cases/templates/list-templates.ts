import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";

export class ListTemplatesHandler {
  constructor(private readonly templates: IDonorTemplateRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<unknown[], DomainError>> {
    const r = await this.templates.findByProject(projectId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    return {
      ok: true,
      value: r.value.map((t) => ({
        id: t.id,
        templateName: t.templateName,
        donorName: t.donorName,
        reportType: t.reportType,
        language: t.language,
        requiredAnnexes: t.requiredAnnexes,
        version: t.version,
        sections: t.sections,
        uploadedById: t.uploadedById,
      })),
    };
  }
}
