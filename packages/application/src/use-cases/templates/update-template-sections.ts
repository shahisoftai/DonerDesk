import type { Result } from "@donordesk/domain";
import { createSection, type DomainError } from "@donordesk/domain";
import type { TemplateSectionInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IAuditLogger } from "../../ports/core.js";
import { attempt, checkExpectedVersion, loadTemplate } from "./load-template.js";

export class UpdateTemplateSectionsHandler {
  constructor(private readonly templates: IDonorTemplateRepository, private readonly audit: IAuditLogger) {}

  async handle(
    ctx: AuthenticatedContext,
    templateId: string,
    sections: TemplateSectionInput[],
    expectedVersion?: number,
  ): Promise<Result<{ version: number }, DomainError>> {
    const loaded = await loadTemplate(this.templates, templateId, ctx.tenant.tenantId);
    if (!loaded.ok) return loaded;
    const t = loaded.value;
    const fresh = checkExpectedVersion(t, expectedVersion);
    if (!fresh.ok) return fresh;
    const before = t.sections.length;
    const revised = attempt(() => t.revise({ sections: sections.map((s, order) => createSection({ ...s, order })) }));
    if (!revised.ok) return revised;
    const saved = await this.templates.update(t, { actorId: ctx.tenant.userId, changeNote: "Sections edited" });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "template.sections_updated",
      entityType: "donor_template",
      entityId: templateId,
      projectId: t.projectId,
      oldValue: JSON.stringify({ sections: before }),
      newValue: JSON.stringify({ sections: t.sections.length, version: t.version }),
    });
    return { ok: true, value: { version: t.version } };
  }
}
