import type { Result, DomainError } from "@donordesk/domain";
import type { UpdateTemplateMetadataInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IAuditLogger } from "../../ports/core.js";
import { attempt, loadTemplate } from "./load-template.js";

export class UpdateTemplateMetadataHandler {
  constructor(private readonly templates: IDonorTemplateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, templateId: string, input: UpdateTemplateMetadataInput): Promise<Result<void, DomainError>> {
    const loaded = await loadTemplate(this.templates, templateId, ctx.tenant.tenantId);
    if (!loaded.ok) return loaded;
    const t = loaded.value;
    const old = { templateName: t.templateName, donorName: t.donorName, reportType: t.reportType, language: t.language };
    const updated = attempt(() => t.updateMetadata(input));
    if (!updated.ok) return updated;
    const saved = await this.templates.update(t, { actorId: ctx.tenant.userId });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "template.metadata_updated",
      entityType: "donor_template",
      entityId: templateId,
      projectId: t.projectId,
      oldValue: JSON.stringify(old),
      newValue: JSON.stringify(input),
    });
    return { ok: true, value: undefined };
  }
}
