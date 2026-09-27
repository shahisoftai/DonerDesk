import type { Result, DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import { toDonorTemplateView, type DonorTemplateView } from "../../services/donor-template-view.js";

export class ListTemplatesHandler {
  constructor(private readonly templates: IDonorTemplateRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<DonorTemplateView[], DomainError>> {
    const r = await this.templates.findByProject(projectId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    return { ok: true, value: r.value.map(toDonorTemplateView) };
  }
}
