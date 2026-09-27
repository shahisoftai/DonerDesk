import type { Result, DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IAuditLogger } from "../../ports/core.js";
import { attempt, loadTemplate } from "./load-template.js";

/** Human sign-off that the template structure is correct; unlocks generation. */
export class MarkTemplateReviewedHandler {
  constructor(private readonly templates: IDonorTemplateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, templateId: string): Promise<Result<{ status: string; version: number }, DomainError>> {
    const loaded = await loadTemplate(this.templates, templateId, ctx.tenant.tenantId);
    if (!loaded.ok) return loaded;
    const t = loaded.value;
    const reviewed = attempt(() => t.markReviewed());
    if (!reviewed.ok) return reviewed;
    const saved = await this.templates.update(t, { actorId: ctx.tenant.userId });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "template.reviewed",
      entityType: "donor_template",
      entityId: templateId,
      projectId: t.projectId,
      newValue: JSON.stringify({ version: t.version, sections: t.sections.length }),
    });
    return { ok: true, value: { status: t.status, version: t.version } };
  }
}
