import type { Result } from "@donordesk/domain";
import { DomainError, Permissions } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IUserRepository } from "../../ports/identity.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { Role } from "@donordesk/domain";

export interface ChangeRoleCommand {
  userId: string;
  role: Role;
}

export class ChangeRoleHandler {
  constructor(private readonly users: IUserRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, cmd: ChangeRoleCommand): Promise<Result<void, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "users.manage");
    const target = await this.users.findById(cmd.userId, ctx.tenant.tenantId);
    if (!target.ok) return target;
    if (!target.value) return { ok: false, error: DomainError.notFound("User", cmd.userId) };
    const user = target.value;
    const from = user.role;
    user.changeRole(cmd.role);
    const update = await this.users.update(user);
    if (!update.ok) return update;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "identity.user.role_changed",
      entityType: "user",
      entityId: cmd.userId,
      oldValue: from,
      newValue: cmd.role,
    });
    return { ok: true, value: undefined };
  }
}
