import type { Result, Role } from "@donordesk/domain";
import { DomainError, Permissions } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IInvitationRepository } from "../../ports/identity.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Withdraws an invitation nobody has accepted (Version 4.000): the link stops working at once and the seat it reserved is free
 * again. An accepted invitation is a joined person, not an invitation: use Deactivate or Delete on the Team page for them.
 * The audit row keeps the role and the email domain, not the address.
 */
export class CancelInvitationHandler {
  constructor(
    private readonly invitations: IInvitationRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, invitationId: string): Promise<Result<{ cancelled: true }, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "users.manage");
    const open = await this.invitations.listOpenByTenant(ctx.tenant.tenantId);
    if (!open.ok) return open;
    const found = open.value.find((i) => i.id === invitationId);
    if (!found) return { ok: false, error: DomainError.notFound("Invitation", invitationId) };
    const gone = await this.invitations.cancelOpen(invitationId, ctx.tenant.tenantId);
    if (!gone.ok) return gone;
    if (!gone.value) return { ok: false, error: DomainError.notFound("Invitation", invitationId) };
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "identity.invitation.cancelled",
      entityType: "invitation",
      entityId: invitationId,
      oldValue: JSON.stringify({ role: found.role, emailDomain: found.email.toString().split("@")[1] ?? "" }),
      newValue: "CANCELLED",
    });
    return { ok: true, value: { cancelled: true } };
  }
}
