import type { Result, DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import { toDonorTemplateView, type DonorTemplateView } from "../../services/donor-template-view.js";
import { loadTemplate } from "./load-template.js";

export class SetTemplateLibraryHandler {
  constructor(private readonly templates: IDonorTemplateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, templateId: string, isLibrary: boolean): Promise<Result<void, DomainError>> {
    const loaded = await loadTemplate(this.templates, templateId, ctx.tenant.tenantId);
    if (!loaded.ok) return loaded;
    loaded.value.setLibrary(isLibrary);
    const saved = await this.templates.update(loaded.value, { actorId: ctx.tenant.userId });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: isLibrary ? "template.library_added" : "template.library_removed",
      entityType: "donor_template",
      entityId: templateId,
      projectId: loaded.value.projectId,
    });
    return { ok: true, value: undefined };
  }
}

export class ListLibraryTemplatesHandler {
  constructor(private readonly templates: IDonorTemplateRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<DonorTemplateView[], DomainError>> {
    const r = await this.templates.findLibrary(ctx.tenant.tenantId);
    if (!r.ok) return r;
    return { ok: true, value: r.value.map(toDonorTemplateView) };
  }
}

/** Copies a template (usually from the library) into a project as version 1. */
export class CloneTemplateHandler {
  constructor(private readonly ids: IIdGenerator, private readonly templates: IDonorTemplateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, templateId: string, projectId: string): Promise<Result<DonorTemplateView, DomainError>> {
    const loaded = await loadTemplate(this.templates, templateId, ctx.tenant.tenantId);
    if (!loaded.ok) return loaded;
    const copy = loaded.value.cloneForProject({ id: this.ids.generate(), projectId, uploadedById: ctx.tenant.userId });
    const saved = await this.templates.create(copy);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "template.cloned",
      entityType: "donor_template",
      entityId: copy.id,
      projectId,
      newValue: JSON.stringify({ sourceTemplateId: templateId }),
    });
    return { ok: true, value: toDonorTemplateView(copy) };
  }
}
