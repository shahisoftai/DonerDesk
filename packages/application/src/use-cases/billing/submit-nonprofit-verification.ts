import type { Result } from "@donordesk/domain";
import { DomainError, NonprofitVerification, Permissions, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { INonprofitVerificationRepository } from "../../ports/billing.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";

export interface SubmitNonprofitVerificationInput {
  registrationNumber: string;
  documentUrl: string;
}

/**
 * Tenant-side submission for the verified nonprofit discount (Phase 22
 * WS-G). One PENDING submission at a time; a rejected or approved prior
 * submission does not block a new one (e.g. renewing an expired registration).
 */
export class SubmitNonprofitVerificationHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly verifications: INonprofitVerificationRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: SubmitNonprofitVerificationInput): Promise<Result<{ id: string }, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "billing.manage");
    const tenantId = ctx.tenant.tenantId.toString();

    const latest = await this.verifications.findLatestByTenant(tenantId);
    if (!latest.ok) return latest;
    if (latest.value?.status === "PENDING") {
      return { ok: false, error: DomainError.conflict("A nonprofit verification is already pending review.") };
    }

    const verification = NonprofitVerification.create({
      id: this.ids.generate(),
      props: {
        tenantId,
        registrationNumber: input.registrationNumber,
        documentUrl: input.documentUrl,
        submittedAt: new Date(),
      },
    });
    const created = await this.verifications.create(verification);
    if (!created.ok) return created;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "billing.nonprofit_verification.submitted",
      entityType: "nonprofit_verification",
      entityId: verification.id,
      newValue: JSON.stringify({ registrationNumber: input.registrationNumber }),
    });

    return { ok: true, value: { id: verification.id } };
  }
}
