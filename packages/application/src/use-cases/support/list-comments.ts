import type { Result } from "@donordesk/domain";
import { DomainError, TenantId } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IUserRepository } from "../../ports/identity.js";
import type { ICommentRepository } from "../../ports/support.js";

type CommentRow = { authorId?: string | null; resolvedById?: string | null };

export class ListCommentsHandler {
  constructor(private readonly repo: ICommentRepository, private readonly users?: IUserRepository) {}

  /** The comments of one thing, each carrying who wrote it (and who resolved it) by name, so no screen has to show an id. */
  async handle(ctx: AuthenticatedContext, entityType: string, entityId: string): Promise<Result<unknown[], DomainError>> {
    const r = await this.repo.findByEntity(entityType, entityId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!this.users) return { ok: true, value: r.value };
    const names = await this.namesFor(r.value as CommentRow[], ctx.tenant.tenantId);
    return {
      ok: true,
      value: (r.value as CommentRow[]).map((c) => ({
        ...c,
        authorName: c.authorId ? names.get(c.authorId) : undefined,
        resolvedByName: c.resolvedById ? names.get(c.resolvedById) : undefined,
      })),
    };
  }

  private async namesFor(rows: CommentRow[], tenantId: TenantId): Promise<Map<string, string>> {
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.authorId) ids.add(row.authorId);
      if (row.resolvedById) ids.add(row.resolvedById);
    }
    const names = new Map<string, string>();
    for (const id of ids) {
      const user = await this.users!.findById(id, tenantId);
      if (user.ok && user.value) names.set(id, user.value.name);
    }
    return names;
  }
}
