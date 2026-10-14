import type { Result } from "@donordesk/domain";
import { DomainError, Permissions } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IInvitationRepository } from "../../ports/identity.js";

export interface PendingInvitationView {
  id: string;
  email: string;
  role: string;
  invitedAt: string;
  expiresAt: string;
  expired: boolean;
  /** Where the invitee accepts. Email delivery may be off, so the inviter needs the link again after leaving the invite form. */
  acceptPath: string;
}

/** The invitations nobody has accepted yet, so an inviter can see who is still outstanding and share the link again. */
export class ListPendingInvitationsHandler {
  constructor(
    private readonly invitations: IInvitationRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<PendingInvitationView[], DomainError>> {
    // The acceptance link is a credential for the invited role, so it is shown only to those who may invite.
    Permissions.require(ctx.tenant.role as import("@donordesk/domain").Role, "users.manage");
    const open = await this.invitations.listOpenByTenant(ctx.tenant.tenantId);
    if (!open.ok) return open;
    const now = this.now().getTime();
    return {
      ok: true,
      value: open.value.map((inv) => ({
        id: inv.id,
        email: inv.email.toString(),
        role: inv.role,
        invitedAt: inv.createdAt.toISOString(),
        expiresAt: inv.expiresAt.toISOString(),
        expired: inv.expiresAt.getTime() < now,
        acceptPath: `/invite/accept?token=${encodeURIComponent(inv.token)}`,
      })),
    };
  }
}
