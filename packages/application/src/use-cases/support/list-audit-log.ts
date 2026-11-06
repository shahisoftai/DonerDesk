import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IUserRepository } from "../../ports/identity.js";
import type { IAuditRepository } from "../../ports/support.js";

export class ListAuditLogHandler {
  constructor(private readonly repo: IAuditRepository, private readonly users?: IUserRepository) {}

  /** The audit trail, each event carrying the actor's name so no screen has to show an id. A platform job has no person, so no name. */
  async handle(ctx: AuthenticatedContext, projectId?: string, limit = 100, offset = 0): Promise<Result<unknown[], DomainError>> {
    const r = await this.repo.listByTenant(ctx.tenant.tenantId, { projectId, limit, offset });
    if (!r.ok) return r;
    if (!this.users) return { ok: true, value: r.value };
    const rows = r.value as Array<{ actorId?: string | null }>;
    const names = new Map<string, string>();
    for (const id of new Set(rows.map((row) => row.actorId).filter((id): id is string => !!id))) {
      const user = await this.users.findById(id, ctx.tenant.tenantId);
      if (user.ok && user.value) names.set(id, user.value.name);
    }
    return { ok: true, value: rows.map((row) => ({ ...row, actorName: row.actorId ? names.get(row.actorId) : undefined })) };
  }
}
