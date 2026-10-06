import type { Result } from "@donordesk/domain";
import { ALL_REPORT_TYPES, type DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDefaultTemplateResolver, ResolvedDefaultTemplate } from "../../ports/default-template-resolver.js";

/** The template each kind of report would start from, so a form can show it before the period exists. */
export class GetDefaultTemplatesHandler {
  constructor(private readonly resolver: IDefaultTemplateResolver) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ types: Record<string, ResolvedDefaultTemplate> }, DomainError>> {
    const resolved = await this.resolver.resolveAll(ctx.tenant.tenantId, projectId, ALL_REPORT_TYPES);
    if (!resolved.ok) return resolved;
    return { ok: true, value: { types: resolved.value } };
  }
}
