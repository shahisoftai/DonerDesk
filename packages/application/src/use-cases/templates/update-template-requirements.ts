import type { Result } from "@donordesk/domain";
import { createTemplateRequirements, type DomainError } from "@donordesk/domain";
import type { TemplateRequirementsPayload } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IAuditLogger } from "../../ports/core.js";
import { attempt, checkExpectedVersion, loadTemplate } from "./load-template.js";

export class UpdateTemplateRequirementsHandler {
  constructor(private readonly templates: IDonorTemplateRepository, private readonly audit: IAuditLogger) {}

  async handle(
    ctx: AuthenticatedContext,
    templateId: string,
    requirements: TemplateRequirementsPayload,
    expectedVersion?: number,
  ): Promise<Result<{ version: number }, DomainError>> {
    const loaded = await loadTemplate(this.templates, templateId, ctx.tenant.tenantId);
    if (!loaded.ok) return loaded;
    const t = loaded.value;
    const fresh = checkExpectedVersion(t, expectedVersion);
    if (!fresh.ok) return fresh;
    const revised = attempt(() => t.revise({ requirements: createTemplateRequirements(requirements) }));
    if (!revised.ok) return revised;
    const saved = await this.templates.update(t, { actorId: ctx.tenant.userId, changeNote: "Requirements edited" });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "template.requirements_updated",
      entityType: "donor_template",
      entityId: templateId,
      projectId: t.projectId,
      newValue: JSON.stringify({ version: t.version, annexes: t.requirements.annexes.length, compliance: t.requirements.compliance.length }),
    });
    return { ok: true, value: { version: t.version } };
  }
}
