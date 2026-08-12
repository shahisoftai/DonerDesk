import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditRepository } from "../../ports/support.js";

export class ListAuditLogHandler {
  constructor(private readonly repo: IAuditRepository) {}

  async handle(ctx: AuthenticatedContext, projectId?: string, limit = 100, offset = 0): Promise<Result<unknown[], DomainError>> {
    const r = await this.repo.listByTenant(ctx.tenant.tenantId, { projectId, limit, offset });
    if (!r.ok) return r;
    return { ok: true, value: r.value };
  }
}
