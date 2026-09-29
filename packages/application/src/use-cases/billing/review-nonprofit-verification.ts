import type { Result } from "@donordesk/domain";
import { DomainError, TenantId } from "@donordesk/domain";
import type { INonprofitVerificationRepository } from "../../ports/billing.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import type { IAuditLogger } from "../../ports/core.js";
export interface NonprofitVerificationSummary {
  id: string;
  tenantId: string;
  registrationNumber: string;
  documentUrl: string;
  status: string;
  submittedAt: string;
}

export class ListPendingNonprofitVerificationsHandler {
  constructor(private readonly verifications: INonprofitVerificationRepository) {}

  async handle(): Promise<Result<NonprofitVerificationSummary[], DomainError>> {
    const result = await this.verifications.listPending();
    if (!result.ok) return result;
    return {
      ok: true,
      value: result.value.map((v) => ({
        id: v.id,
        tenantId: v.tenantId,
        registrationNumber: v.registrationNumber,
        documentUrl: v.documentUrl,
        status: v.status,
        submittedAt: v.submittedAt.toISOString(),
      })),
    };
  }
}

/**
 * SuperAdmin approve/reject actions for the nonprofit verification queue
 * (Phase 22 WS-G.1a). Approval sets `Organization.nonprofitVerifiedAt`,
 * which gates the discounted Creem checkout product — it never changes
 * domain plan limits (discounts are a pricing concern, not an entitlement
 * one). Wired behind the same SuperAdmin session gate as every other
 * platform control-plane action (apps/api/src/routes/superadmin.ts).
 */
export class ApproveNonprofitVerificationHandler {
  constructor(
    private readonly verifications: INonprofitVerificationRepository,
    private readonly orgs: IOrganizationRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(actorId: string, verificationId: string): Promise<Result<void, DomainError>> {
    const found = await this.verifications.findById(verificationId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("NonprofitVerification", verificationId) };
    const verification = found.value;
    const now = new Date();

    try {
      verification.approve(actorId, now);
    } catch (e) {
      if (e instanceof DomainError) return { ok: false, error: e };
      throw e;
    }
    const updated = await this.verifications.update(verification);
    if (!updated.ok) return updated;

    const tenantId = TenantId.create(verification.tenantId);
    const orgResult = await this.orgs.findByTenant(tenantId);
    if (!orgResult.ok) return orgResult;
    // A missing organization row is a data-integrity problem, not a skippable
    // step: approving must never silently succeed without flipping the flag
    // the checkout discount actually reads.
    if (!orgResult.value) {
      return { ok: false, error: DomainError.billingStateInvalid("Organization record missing for this tenant; cannot apply the nonprofit discount.") };
    }
    orgResult.value.markNonprofitVerified(now);
    const orgUpdated = await this.orgs.update(orgResult.value);
    if (!orgUpdated.ok) return orgUpdated;

    await this.audit.record({
      tenantId,
      actorId,
      eventType: "billing.nonprofit_verification.approved",
      entityType: "nonprofit_verification",
      entityId: verificationId,
    });
    return { ok: true, value: undefined };
  }
}

export class RejectNonprofitVerificationHandler {
  constructor(
    private readonly verifications: INonprofitVerificationRepository,
    private readonly orgs: IOrganizationRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(actorId: string, verificationId: string, reason: string): Promise<Result<void, DomainError>> {
    const found = await this.verifications.findById(verificationId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("NonprofitVerification", verificationId) };
    const verification = found.value;

    try {
      verification.reject(actorId, reason, new Date());
    } catch (e) {
      if (e instanceof DomainError) return { ok: false, error: e };
      throw e;
    }
    const updated = await this.verifications.update(verification);
    if (!updated.ok) return updated;

    // Latest review outcome wins: if a previously-approved verification had set
    // Organization.nonprofitVerifiedAt (e.g. an expired certificate renewing),
    // a rejection revokes it — without this, one approval would grant the 40%
    // discount for life even after the renewal review fails. Idempotent (a
    // no-op when the org was never verified).
    let discountRevoked = false;
    const tenantId = TenantId.create(verification.tenantId);
    const orgResult = await this.orgs.findByTenant(tenantId);
    if (orgResult.ok && orgResult.value?.nonprofitVerifiedAt) {
      orgResult.value.clearNonprofitVerification();
      const orgUpdated = await this.orgs.update(orgResult.value);
      if (!orgUpdated.ok) return orgUpdated;
      discountRevoked = true;
    }

    await this.audit.record({
      tenantId,
      actorId,
      eventType: "billing.nonprofit_verification.rejected",
      entityType: "nonprofit_verification",
      entityId: verificationId,
      newValue: JSON.stringify({ reason, discountRevoked }),
    });
    return { ok: true, value: undefined };
  }
}
