import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICommentRepository } from "../../ports/support.js";
import type { IAuditLogger } from "../../ports/core.js";

export class ResolveCommentHandler {
  constructor(private readonly repo: ICommentRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, commentId: string): Promise<Result<void, DomainError>> {
    const r = await this.repo.resolve(commentId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "comment.resolved",
      entityType: "comment",
      entityId: commentId,
    });
    return { ok: true, value: undefined };
  }
}
