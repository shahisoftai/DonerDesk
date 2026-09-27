import type { Result, NumericReplacement } from "@donordesk/domain";
import { DomainError, suggestNumericReplacement } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportClaimRepository, IReportDraftRepository, IIndicatorAnalyticsService } from "../../ports/reporting.js";

/**
 * Report Editor B3 — the one-click correction for a statement whose number
 * does not match the evidence ("Use 11,860 from evidence"). Computed on
 * demand against the current verified findings; `null` whenever the right
 * value is not unambiguous. Read-only.
 */
export class GetClaimSuggestionHandler {
  constructor(
    private readonly claims: IReportClaimRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly analytics: IIndicatorAnalyticsService,
  ) {}

  async handle(ctx: AuthenticatedContext, claimId: string): Promise<Result<{ suggestion: NumericReplacement | null }, DomainError>> {
    const claimResult = await this.claims.findById(claimId, ctx.tenant.tenantId);
    if (!claimResult.ok) return claimResult;
    const claim = claimResult.value;
    if (!claim) return { ok: false, error: DomainError.notFound("ReportClaim", claimId) };
    if (claim.resolvedById !== undefined || claim.verificationReasonCode !== "VALUE_MISMATCH" || claim.sources.length === 0) {
      return { ok: true, value: { suggestion: null } };
    }

    const draftResult = await this.drafts.findById(claim.reportDraftId, ctx.tenant.tenantId);
    if (!draftResult.ok) return draftResult;
    const draft = draftResult.value;
    if (!draft) return { ok: false, error: DomainError.notFound("ReportDraft", claim.reportDraftId) };

    const findings = await this.analytics.computeFindings({
      reportingPeriodId: draft.reportingPeriodId,
      projectId: draft.projectId,
      tenantId: ctx.tenant.tenantId,
    });
    if (!findings.ok) return findings;

    return {
      ok: true,
      value: {
        suggestion: suggestNumericReplacement({
          claimText: claim.text,
          verificationResult: claim.verificationResult,
          verificationReasonCode: claim.verificationReasonCode,
          sources: claim.sources,
          findings: findings.value,
        }),
      },
    };
  }
}
