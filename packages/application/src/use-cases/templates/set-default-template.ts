import type { Result, DomainError } from "@donordesk/domain";
import { ReportingProfile } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IReportingProfileRepository } from "../../ports/setup.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import { loadTemplate } from "./load-template.js";

/**
 * Sets or clears a project's default donor template: the one
 * `CreateReportingPeriodHandler` pre-selects for a new reporting period, and
 * the one `ProjectReadinessService` checks still exists (`DEFAULT_TEMPLATE_MISSING`).
 * A project has at most one default; setting a new one replaces the previous
 * without a separate "unset" step. Only ever touches `defaultTemplateId` —
 * every other reporting-profile field (language, tone, ...) is left as-is,
 * and a profile is created with its normal defaults if the project has none yet.
 */
export class SetDefaultTemplateHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly templates: IDonorTemplateRepository,
    private readonly profiles: IReportingProfileRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, templateId: string, isDefault: boolean): Promise<Result<void, DomainError>> {
    const loaded = await loadTemplate(this.templates, templateId, ctx.tenant.tenantId);
    if (!loaded.ok) return loaded;
    const template = loaded.value;

    const existingResult = await this.profiles.findByProject(template.projectId, ctx.tenant.tenantId);
    if (!existingResult.ok) return existingResult;
    const existing = existingResult.value;

    // Clearing a template that isn't currently the default is a no-op.
    if (!isDefault && existing?.defaultTemplateId !== templateId) return { ok: true, value: undefined };

    const nextId = isDefault ? templateId : undefined;
    if (existing) {
      existing.setDefaultTemplateId(nextId, ctx.tenant.userId);
      const saved = await this.profiles.update(existing);
      if (!saved.ok) return saved;
    } else {
      const created = await this.profiles.create(
        ReportingProfile.create({
          id: this.ids.generate(),
          tenantId: ctx.tenant.tenantId.toString(),
          projectId: template.projectId,
          defaultTemplateId: nextId,
          createdById: ctx.tenant.userId,
        }),
      );
      if (!created.ok) return created;
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: isDefault ? "template.set_default" : "template.unset_default",
      entityType: "donor_template",
      entityId: templateId,
      projectId: template.projectId,
    });
    return { ok: true, value: undefined };
  }
}
