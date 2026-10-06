import type { Result } from "@donordesk/domain";
import { DomainError, findingsExplaining } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportClaimRepository, IReportSectionRepository, IReportDraftRepository, IIndicatorAnalyticsService } from "../../ports/reporting.js";
import type { ResolveReportClaimHandler } from "./resolve-report-claim.js";

/**
 * One click for a figure flag on a number the data actually has: when every result figure in the statement is a value a
 * verified indicator finding carries (period, cumulative, life-of-project, target, percent of target ...), the claim is
 * accepted with a note that names the indicator, through the same resolver (same permission, same audit) as a manual
 * decision. When any figure is not explained it refuses and says so: the person decides with their own note.
 */
export class ConfirmClaimMatchesIndicatorHandler {
  constructor(
    private readonly claims: IReportClaimRepository,
    private readonly sections: IReportSectionRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly analytics: IIndicatorAnalyticsService,
    private readonly resolver: Pick<ResolveReportClaimHandler, "handle">,
  ) {}

  async handle(ctx: AuthenticatedContext, claimId: string): Promise<Result<{ claimId: string; indicators: string[] }, DomainError>> {
    const found = await this.claims.findById(claimId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const claim = found.value;
    if (!claim) return { ok: false, error: DomainError.notFound("ReportClaim", claimId) };

    const section = await this.sections.findById(claim.sectionId, ctx.tenant.tenantId);
    if (!section.ok) return section;
    if (!section.value) return { ok: false, error: DomainError.notFound("ReportSection", claim.sectionId) };
    const draft = await this.drafts.findById(section.value.reportDraftId, ctx.tenant.tenantId);
    if (!draft.ok) return draft;
    if (!draft.value) return { ok: false, error: DomainError.notFound("ReportDraft", section.value.reportDraftId) };

    const findings = await this.analytics.computeFindings({ reportingPeriodId: draft.value.reportingPeriodId, projectId: draft.value.projectId, tenantId: ctx.tenant.tenantId });
    if (!findings.ok) return findings;

    const indicators = findingsExplaining(claim.numericAtoms.map((a) => ({ value: a.value, role: a.role, isPercent: a.isPercent })), findings.value);
    if (!indicators) {
      return { ok: false, error: DomainError.validation("Some figure in this statement is not a verified indicator value, so it cannot be confirmed this way. Decide it with a note instead.") };
    }
    const resolved = await this.resolver.handle(ctx, claimId, {
      resolution: "ACCEPTED_WITH_LIMITATION",
      notes: `Confirmed against the verified indicator${indicators.length === 1 ? "" : "s"} ${indicators.join(", ")}.`,
    });
    if (!resolved.ok) return resolved;
    return { ok: true, value: { claimId: resolved.value.claimId, indicators } };
  }
}
