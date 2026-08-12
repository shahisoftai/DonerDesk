import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { INotificationRepository } from "../../ports/support.js";

export class MarkNotificationReadHandler {
  constructor(private readonly repo: INotificationRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, notificationId: string): Promise<Result<void, DomainError>> {
    const r = await this.repo.markRead(notificationId, ctx.tenant.userId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "NOTIFICATION_READ",
      entityType: "Notification",
      entityId: notificationId,
    });
    return { ok: true, value: undefined };
  }
}
