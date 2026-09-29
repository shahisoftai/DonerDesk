import type { Result } from "@donordesk/domain";
import { DomainError, Email, TenantId, User, UserId } from "@donordesk/domain";
import type { Role } from "@donordesk/domain";
import type { IInvitationRepository, IUserRepository, IAuthProvider } from "../../ports/identity.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { EntitlementService } from "../../services/entitlement-service.js";
import { applyEntitlementLimit } from "../../services/entitlement-service.js";

export interface AcceptInvitationCommand {
  token: string;
  name: string;
  password: string;
}

export interface AcceptInvitationResult {
  userId: string;
  tenantId: string;
  role: Role;
  /** Session token for the freshly created member (7-day, same as signup). */
  token: string;
}

/**
 * WS-C prerequisite: the invitation-acceptance flow the seat accounting always
 * assumed. Redeems a single-use invitation token by creating the member in the
 * inviting tenant at the invited role and marking the invitation accepted.
 *
 * The seat-cap re-check happens per-request here (VIEWER invites draw from the
 * `viewerSeats` pool, others from `maxSeats`), so an invite that was valid when
 * sent is still validated against the tenant's *current* occupancy at
 * acceptance — the atomic-per-request guarantee the plan text called for.
 * Like every other seat check it is check-then-create, not a DB transaction.
 *
 * Runs on the admin connection's container (public route, no tenant session
 * yet): the invitation token itself is the capability, single-use and
 * time-boxed by the aggregate guards.
 */
export class AcceptInvitationHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly users: IUserRepository,
    private readonly invitations: IInvitationRepository,
    private readonly auth: IAuthProvider,
    private readonly audit: IAuditLogger,
    private readonly entitlements: EntitlementService,
  ) {}

  /** Read-side preview for the accept page: who was invited, where, as what. */
  async preview(token: string): Promise<Result<{ email: string; role: Role; tenantId: string; expiresAt: string }, DomainError>> {
    const found = await this.invitations.findByToken(token);
    if (!found.ok) return found;
    const invitation = found.value;
    if (!invitation) return { ok: false, error: DomainError.notFound("Invitation", "token") };
    return {
      ok: true,
      value: {
        email: invitation.email.toString(),
        role: invitation.role,
        tenantId: invitation.tenantId.toString(),
        expiresAt: invitation.expiresAt.toISOString(),
      },
    };
  }

  async handle(cmd: AcceptInvitationCommand): Promise<Result<AcceptInvitationResult, DomainError>> {
    const found = await this.invitations.findByToken(cmd.token);
    if (!found.ok) return found;
    const invitation = found.value;
    if (!invitation) return { ok: false, error: DomainError.notFound("Invitation", "token") };
    // Fail fast before any side effect: the aggregate guards single-use, but a
    // pre-check keeps an expired/replayed token from creating an orphaned user
    // first. accept() below still re-guards (race with a concurrent redemption).
    if (invitation.isExpired()) return { ok: false, error: DomainError.invalidTransition("Invitation expired") };
    if (invitation.isAccepted()) return { ok: false, error: DomainError.invalidTransition("Invitation already accepted") };

    const tenantId = invitation.tenantId;
    const existing = await this.users.findByEmail(invitation.email.toString(), tenantId);
    if (existing.ok && existing.value) {
      return { ok: false, error: DomainError.conflict("A user with this email already exists in the workspace — sign in instead.") };
    }

    // Seat capacity: same pools as InviteUserHandler, evaluated at acceptance
    // time so a stale invitation cannot claim a seat that no longer exists.
    const entitlementResult = await this.entitlements.resolve({ tenantId: tenantId.toString() });
    if (!entitlementResult.ok) return entitlementResult;
    const entitlement = entitlementResult.value;
    const isViewer = invitation.role === "VIEWER";
    const limit = isViewer ? entitlement.limits.viewerSeats : entitlement.limits.maxSeats;
    if (limit !== null) {
      const usageResult = await this.entitlements.usageSnapshot({ tenantId: tenantId.toString() });
      if (!usageResult.ok) return usageResult;
      const used = isViewer ? usageResult.value.viewerSeats : usageResult.value.seats;
      if (used >= limit) {
        // No new user exists yet to attribute this to; the inviter is the
        // closest real actor in the tenant for the audit trail.
        const enforced = await applyEntitlementLimit(
          this.audit,
          tenantId,
          invitation.invitedById,
          isViewer ? "VIEWERS" : "SEATS",
          limit,
          used,
        );
        if (!enforced.ok) return enforced;
      }
    }

    let passwordHash: string;
    try {
      passwordHash = await this.auth.hashPassword(cmd.password);
    } catch (e) {
      return { ok: false, error: e instanceof DomainError ? e : DomainError.validation("Could not hash password") };
    }
    const userId = this.ids.generate();
    const user = User.create({
      id: UserId.create(userId),
      tenantId,
      email: invitation.email,
      name: cmd.name,
      passwordHash,
      role: invitation.role,
      assignedProjectIds: invitation.projectIds,
    });
    user.activate();
    const created = await this.users.create(user);
    if (!created.ok) return created;

    // Single-use: the aggregate throws on a second accept or an expired one.
    try {
      invitation.accept();
    } catch (e) {
      if (e instanceof DomainError) return { ok: false, error: e };
      throw e;
    }
    const persisted = await this.invitations.update(invitation);
    if (!persisted.ok) return persisted;

    await this.audit.record({
      tenantId,
      actorId: userId,
      eventType: "identity.invitation_accepted",
      entityType: "invitation",
      entityId: invitation.id,
      newValue: JSON.stringify({ email: invitation.email.toString(), role: invitation.role, invitedById: invitation.invitedById }),
    });

    const token = await this.auth.sign(
      { sub: userId, tid: tenantId.toString(), role: invitation.role, name: cmd.name, email: invitation.email.toString() },
      60 * 60 * 24 * 7,
    );

    return {
      ok: true,
      value: { userId, tenantId: tenantId.toString(), role: invitation.role, token },
    };
  }
}
