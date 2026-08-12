import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICommentRepository } from "../../ports/support.js";

export class ListCommentsHandler {
  constructor(private readonly repo: ICommentRepository) {}

  async handle(ctx: AuthenticatedContext, entityType: string, entityId: string): Promise<Result<unknown[], DomainError>> {
    const r = await this.repo.findByEntity(entityType, entityId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    return { ok: true, value: r.value };
  }
}
