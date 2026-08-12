import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICommentRepository } from "../../ports/support.js";
import type { IIdGenerator, IAuditLogger, INotificationPort } from "../../ports/core.js";
import type { CreateCommentInput } from "@donordesk/contracts";

export class AddCommentHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly repo: ICommentRepository,
    private readonly audit: IAuditLogger,
    private readonly notify: INotificationPort,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateCommentInput): Promise<Result<{ id: string }, DomainError>> {
    const id = this.ids.generate();
    const saved = await this.repo.create({
      id,
      tenantId: ctx.tenant.tenantId.toString(),
      entityType: input.entityType,
      entityId: input.entityId,
      commentText: input.commentText,
      authorId: ctx.tenant.userId,
      mentionedUserId: input.mentionedUserId,
      status: "OPEN",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "comment.created",
      entityType: input.entityType,
      entityId: input.entityId,
    });
    if (input.mentionedUserId) {
      await this.notify.notify({
        tenantId: ctx.tenant.tenantId,
        recipientId: input.mentionedUserId,
        type: "COMMENT_MENTION",
        title: "You were mentioned in a comment",
        message: input.commentText.slice(0, 200),
        relatedEntityType: input.entityType,
        relatedEntityId: input.entityId,
      });
    }
    return { ok: true, value: { id } };
  }
}
