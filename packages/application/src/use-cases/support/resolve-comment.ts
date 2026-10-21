import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICommentRepository } from "../../ports/support.js";
import type { IAuditLogger } from "../../ports/core.js";

/** Resolves a thread by its first comment, recording who did it. A reply is resolved through its thread, not on its own. */
export class ResolveCommentHandler {
  constructor(private readonly repo: ICommentRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, commentId: string): Promise<Result<void, DomainError>> {
    const found = await this.repo.findById(commentId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Comment", commentId) };
    if (found.value.parentId) return { ok: false, error: DomainError.validation("Resolve the thread from its first comment.") };
    const r = await this.repo.resolve(commentId, ctx.tenant.tenantId, ctx.tenant.userId);
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

/** Opens a resolved thread again, so the conversation can continue. */
export class ReopenCommentHandler {
  constructor(private readonly repo: ICommentRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, commentId: string): Promise<Result<void, DomainError>> {
    const found = await this.repo.findById(commentId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Comment", commentId) };
    if (found.value.parentId) return { ok: false, error: DomainError.validation("Reopen the thread from its first comment.") };
    if (found.value.status !== "RESOLVED") return { ok: true, value: undefined };
    const r = await this.repo.reopen(commentId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "comment.reopened", entityType: "comment", entityId: commentId });
    return { ok: true, value: undefined };
  }
}
