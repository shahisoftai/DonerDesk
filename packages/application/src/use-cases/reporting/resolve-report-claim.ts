import type { Result } from "@donordesk/domain";
import { DomainError, Permissions, resolveClaimDecision, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportClaimRepository,
  IReportSectionRepository,
  IReportAssuranceService,
} from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface ResolveReportClaimInput {
  resolution: "ACCEPTED_WITH_LIMITATION" | "EXCLUDED";
  notes?: string;
}

/**
 * Applies permission-controlled claim resolutions. ACCEPTED_WITH_LIMITATION
 * requires the report.resolve-claim capability and a single aggregate note and
 * preserves the failed verification status; EXCLUDED requires the grants-level
 * report.override-confidentiality capability when the claim cites a
 * confidential source. Both paths write audit events.
 *
 * P0-1 — After persisting the resolution the handler reconciles the owning
 * section's revision: the resolution-aware assurance service re-runs and, when
 * every blocking material claim is now resolved, promotes the revision to
 * CURRENT so the section can be approved. Resolutions are carried forward, so
 * a reassessment never resurrects an accepted/excluded claim.
 */
export class ResolveReportClaimHandler {
  constructor(
    private readonly claims: IReportClaimRepository,
    private readonly audit: IAuditLogger,
    private readonly sections: IReportSectionRepository,
    private readonly assuranceService: IReportAssuranceService,
  ) {}

  /**
   * Returns the id of the claim that carries the decision afterwards:
   * reconciliation re-creates a section's claims, so the id can change.
   */
  async handle(ctx: AuthenticatedContext, claimId: string, input: ResolveReportClaimInput): Promise<Result<{ claimId: string }, DomainError>> {
    const r = await this.claims.findById(claimId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ReportClaim", claimId) };
    const claim = r.value;

    const isConfidentialSource = claim.verificationReasonCode === "CONFIDENTIALITY_RESTRICTED" ||
      claim.verificationDetail.toLowerCase().includes("confidential");
    const decision = resolveClaimDecision({
      resolution: input.resolution,
      notes: input.notes,
      isConfidentialSource,
    });

    if (decision.requiredCapability === "report.resolve-claim" && !Permissions.can(ctx.tenant.role as Role, "report.resolve-claim")) {
      return {
        ok: false,
        error: DomainError.forbidden("Only report managers can accept a claim with a limitation", { capability: "report.resolve-claim" }),
      };
    }
    if (decision.requiredCapability === "report.override-confidentiality" && !Permissions.can(ctx.tenant.role as Role, "report.override-confidentiality")) {
      return {
        ok: false,
        error: DomainError.forbidden("A grants-level authority is required to exclude a claim over a confidential source", { capability: "report.override-confidentiality" }),
      };
    }

    claim.resolve({
      result: input.resolution,
      notes: decision.notes,
      by: ctx.tenant.userId,
    });
    const saved = await this.claims.update(claim);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: `report.claim.${input.resolution.toLowerCase()}`,
      entityType: "report_claim",
      entityId: claimId,
      projectId: claim.projectId,
      newValue: JSON.stringify({ resolution: input.resolution, notes: decision.notes }),
    });

    // P0-1 — Reconcile the owning section's revision so a fully-resolved
    // section reaches an approvable (CURRENT) state. Best-effort: a reconcile
    // failure is logged but must not fail the resolution that already persisted.
    let currentClaimId = claimId;
    try {
      const sectionResult = await this.sections.findById(claim.sectionId, ctx.tenant.tenantId);
      const section = sectionResult.ok ? sectionResult.value : undefined;
      const revisionId = section?.currentRevisionId;
      if (revisionId) {
        const assessed = await this.assuranceService.assessRevision({
          ctx: { tenantId: ctx.tenant.tenantId, userId: ctx.tenant.userId },
          sectionId: claim.sectionId,
          revisionId,
        });
        if (assessed.ok) {
          currentClaimId = assessed.value.claims.find((c) => c.fingerprint === claim.fingerprint)?.id ?? claimId;
        }
      }
    } catch (error) {
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "report.claim.reconcile_failed",
        entityType: "report_claim",
        entityId: claimId,
        projectId: claim.projectId,
        systemNote: `Reconciliation after resolution failed: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => undefined);
    }

    return { ok: true, value: { claimId: currentClaimId } };
  }
}
