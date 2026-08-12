import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { INotificationRepository } from "../../ports/support.js";

export class ListNotificationsHandler {
  constructor(private readonly repo: INotificationRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<unknown[], DomainError>> {
    const r = await this.repo.listForUser(ctx.tenant.userId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    return { ok: true, value: r.value };
  }
}
