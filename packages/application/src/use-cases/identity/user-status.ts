import type { Result, Role } from "@donordesk/domain";
import { DomainError, Email, Permissions } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IUserRepository } from "../../ports/identity.js";
import type { IProjectMemberRepository } from "../../ports/project-members.js";
import type { IAuditLogger } from "../../ports/core.js";

export type UserStatusAction = "DEACTIVATE" | "REACTIVATE" | "DELETE";

export interface SetUserStatusCommand { userId: string; action: UserStatusAction }

/**
 * Deactivate, reactivate or delete a team member (Version 4.000). One table says what each action does:
 * - DEACTIVATE: the person cannot sign in and every open session is refused on its next request (the auth middleware reads the
 *   status); nothing they did changes; reversible. A deactivated person still holds their seat until deleted.
 * - REACTIVATE: back to ACTIVE.
 * - DELETE: final. The account is REMOVED (seat freed), their project memberships end, and their name and email are replaced so
 *   the address can be invited again and no personal details stay in the directory. Records they made (activities, values,
 *   audit events) keep pointing at the account, which now reads "Removed user"; nothing they made is deleted.
 * Nobody may act on their own account, and the organisation always keeps at least one active administrator.
 */
const ACTIONS: Readonly<Record<UserStatusAction, { from: ReadonlyArray<string>; event: string }>> = {
  DEACTIVATE: { from: ["ACTIVE", "INVITED"], event: "identity.user.deactivated" },
  REACTIVATE: { from: ["SUSPENDED"], event: "identity.user.reactivated" },
  DELETE: { from: ["ACTIVE", "INVITED", "SUSPENDED"], event: "identity.user.deleted" },
};

export class SetUserStatusHandler {
  constructor(
    private readonly users: IUserRepository,
    private readonly members: IProjectMemberRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, cmd: SetUserStatusCommand): Promise<Result<{ status: string }, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "users.manage");
    const rule = ACTIONS[cmd.action];
    if (!rule) return { ok: false, error: DomainError.validation("Unknown action.") };
    if (cmd.userId === ctx.tenant.userId) {
      return { ok: false, error: DomainError.validation("You cannot deactivate or delete your own account. Ask another administrator.") };
    }
    const found = await this.users.findById(cmd.userId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const user = found.value;
    if (!user || user.status === "REMOVED") return { ok: false, error: DomainError.notFound("User", cmd.userId) };
    if (!rule.from.includes(user.status)) {
      return { ok: false, error: DomainError.validation(cmd.action === "REACTIVATE" ? "This person is not deactivated." : "This person is already deactivated.") };
    }

    if (user.role === "ADMIN" && cmd.action !== "REACTIVATE") {
      const all = await this.users.listByTenant(ctx.tenant.tenantId);
      if (!all.ok) return all;
      const otherAdmins = all.value.filter((u) => u.role === "ADMIN" && u.status === "ACTIVE" && u.id.toString() !== user.id.toString());
      if (otherAdmins.length === 0) {
        return { ok: false, error: DomainError.validation("The organisation needs at least one active administrator. Make someone else an administrator first.") };
      }
    }

    const before = user.status;
    const oldEmail = user.email.toString();
    if (cmd.action === "DEACTIVATE") user.suspend();
    else if (cmd.action === "REACTIVATE") user.activate();
    else {
      const projectIds = await this.members.listActiveProjectIdsForUser(user.id.toString(), ctx.tenant.tenantId);
      if (!projectIds.ok) return projectIds;
      for (const projectId of projectIds.value) {
        const member = await this.members.findByUserAndProject(projectId, user.id.toString(), ctx.tenant.tenantId);
        if (!member.ok) return member;
        if (member.value && member.value.status !== "REMOVED") {
          member.value.remove();
          const saved = await this.members.update(member.value);
          if (!saved.ok) return saved;
        }
      }
      user.rename("Removed user");
      user.changeEmail(Email.create(`removed+${user.id.toString()}@deleted.invalid`));
      user.assignProjects([]);
      user.remove();
    }
    const saved = await this.users.update(user);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: rule.event,
      entityType: "user",
      entityId: cmd.userId,
      oldValue: before,
      // A deletion records that it happened and the role, never the person's details again.
      newValue: cmd.action === "DELETE" ? JSON.stringify({ status: "REMOVED", role: user.role, hadEmailDomain: oldEmail.split("@")[1] ?? "" }) : user.status,
    });
    return { ok: true, value: { status: user.status } };
  }
}
