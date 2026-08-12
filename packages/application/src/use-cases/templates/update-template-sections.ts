import type { Result } from "@donordesk/domain";
import { DomainError, createSection } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { TemplateSectionInput } from "@donordesk/contracts";

export class UpdateTemplateSectionsHandler {
  constructor(private readonly templates: IDonorTemplateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, templateId: string, sections: TemplateSectionInput[]): Promise<Result<void, DomainError>> {
    const r = await this.templates.findById(templateId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("DonorTemplate", templateId) };
    const t = r.value;
    t.setSections(sections.map((s) => createSection(s)));
    const saved = await this.templates.update(t);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "template.sections_updated",
      entityType: "donor_template",
      entityId: templateId,
    });
    return { ok: true, value: undefined };
  }
}
