import type { Result } from "@donordesk/domain";
import { COMMENTABLE_ENTITIES, DomainError, checkReply, commentRecipients, type CommentableType } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICommentRepository } from "../../ports/support.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { ICommentTargets, IPersonNotifier } from "../../ports/reminders.js";
import type { CreateCommentInput } from "@donordesk/contracts";

export class AddCommentHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly repo: ICommentRepository,
    private readonly audit: IAuditLogger,
    private readonly notify: IPersonNotifier,
    private readonly targets: ICommentTargets,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateCommentInput): Promise<Result<{ id: string }, DomainError>> {
    const target = await this.targets.resolve(ctx.tenant.tenantId, input.entityType, input.entityId);
    if (!target) return { ok: false, error: DomainError.notFound("Item", input.entityId) };
    // A reply goes under the first comment of a thread on the same thing, and tells the person who started it.
    let threadAuthorId: string | undefined;
    if (input.parentId) {
      const parent = await this.repo.findById(input.parentId, ctx.tenant.tenantId);
      if (!parent.ok) return parent;
      if (!parent.value) return { ok: false, error: DomainError.notFound("Comment", input.parentId) };
      const verdict = checkReply(parent.value, { entityType: input.entityType, entityId: input.entityId });
      if (!verdict.ok) return { ok: false, error: DomainError.validation(verdict.reason) };
      threadAuthorId = parent.value.authorId;
    }
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
      ...(input.parentId ? { parentId: input.parentId } : {}),
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
    const type = input.entityType as CommentableType;
    for (const recipientId of commentRecipients(type, ctx.tenant.userId, input.mentionedUserId, target.owners, threadAuthorId)) {
      await this.notify.send({
        tenantId: ctx.tenant.tenantId, recipientId, type: "COMMENT_MENTION", urgent: false,
        title: `New comment on a ${COMMENTABLE_ENTITIES[type].label}`,
        message: `${target.title}: ${input.commentText.slice(0, 160)}`,
        relatedEntityType: input.entityType, relatedEntityId: input.entityId,
      });
    }
    return { ok: true, value: { id } };
  }
}
