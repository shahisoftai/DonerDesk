import type { Result } from "@donordesk/domain";
import { DomainError, Email, Invitation, TenantId, Permissions } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IInvitationRepository, IUserRepository } from "../../ports/identity.js";
import type { IIdGenerator } from "../../ports/core.js";
import type { IAuditLogger, INotificationPort } from "../../ports/core.js";
import type { EntitlementService } from "../../services/entitlement-service.js";
import { applyEntitlementLimit } from "../../services/entitlement-service.js";

export interface InviteUserCommand {
  email: string;
  role: import("@donordesk/domain").Role;
  projectIds?: string[];
}

export class InviteUserHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly users: IUserRepository,
    private readonly invitations: IInvitationRepository,
    private readonly audit: IAuditLogger,
    private readonly notify: INotificationPort,
    private readonly entitlements: EntitlementService,
  ) {}

  async handle(ctx: AuthenticatedContext, cmd: InviteUserCommand): Promise<Result<{ invitationId: string; token: string }, DomainError>> {
    Permissions.require(ctx.tenant.role as import("@donordesk/domain").Role, "users.manage");
    const tenantId = ctx.tenant.tenantId;
    const email = Email.create(cmd.email);
    const existing = await this.users.findByEmail(email.toString(), tenantId);
    if (existing.ok && existing.value) {
      return { ok: false, error: DomainError.conflict("User already exists") };
    }

    // Seat capacity: an invitation reserves a seat. VIEWER invites draw from
    // the separate `viewerSeats` pool and never consume a full `maxSeats` slot.
    const entitlementResult = await this.entitlements.resolve({ tenantId: tenantId.toString() });
    if (!entitlementResult.ok) return entitlementResult;
    const entitlement = entitlementResult.value;
    const isViewer = cmd.role === "VIEWER";
    const limit = isViewer ? entitlement.limits.viewerSeats : entitlement.limits.maxSeats;
    if (limit !== null) {
      const usageResult = await this.entitlements.usageSnapshot({ tenantId: tenantId.toString() });
      if (!usageResult.ok) return usageResult;
      const used = isViewer ? usageResult.value.viewerSeats : usageResult.value.seats;
      if (used >= limit) {
        const enforced = await applyEntitlementLimit(this.audit, tenantId, ctx.tenant.userId, isViewer ? "VIEWERS" : "SEATS", limit, used);
        if (!enforced.ok) return enforced;
      }
    }

    const id = this.ids.generate();
    const token = this.ids.generate();
    const inv = Invitation.create({
      id,
      tenantId,
      email,
      role: cmd.role,
      invitedById: ctx.tenant.userId,
      token,
      projectIds: cmd.projectIds ?? [],
    });
    const persisted = await this.invitations.create(inv);
    if (!persisted.ok) return persisted;
    await this.audit.record({
      tenantId,
      actorId: ctx.tenant.userId,
      eventType: "identity.user.invited",
      entityType: "invitation",
      entityId: id,
      newValue: JSON.stringify({ email: email.toString(), role: cmd.role }),
    });
    await this.notify.notify({
      tenantId,
      recipientId: email.toString(),
      type: "INVITATION",
      title: "You're invited to join DonorDesk",
      message: `You have been invited as ${cmd.role}. Open the invitation link to get started.`,
    });
    return { ok: true, value: { invitationId: id, token } };
  }
}
