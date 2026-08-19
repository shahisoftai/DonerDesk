import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportDraftRepository,
  IReportSectionRepository,
  IReportClaimRepository,
  IReportRevisionRepository,
  IResolvedRequirementsRepository,
} from "../../ports/reporting.js";

/**
 * Reads the current assurance state of every section in a draft: the current
 * revision, its assurance state, per-claim verification, and coverage. This is
 * the read model behind the review and exception UX.
 */
export class GetReportAssuranceHandler {
  constructor(
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly claims: IReportClaimRepository,
    private readonly revisions: IReportRevisionRepository,
    private readonly requirements: IResolvedRequirementsRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, draftId: string): Promise<Result<unknown, DomainError>> {
    const draftResult = await this.drafts.findById(draftId, ctx.tenant.tenantId);
    if (!draftResult.ok) return draftResult;
    const draft = draftResult.value;
    if (!draft) return { ok: false, error: DomainError.notFound("ReportDraft", draftId) };

    const sectionsResult = await this.sections.findByReportDraft(draftId, ctx.tenant.tenantId);
    if (!sectionsResult.ok) return sectionsResult;
    const claimsResult = await this.claims.findByDraft(draftId, ctx.tenant.tenantId);
    if (!claimsResult.ok) return claimsResult;
    const revisionsResult = await this.revisions.findByDraft(draftId, ctx.tenant.tenantId);
    if (!revisionsResult.ok) return revisionsResult;
    const requirementsResult = await this.requirements.findLatestForPeriod(draft.reportingPeriodId, ctx.tenant.tenantId);
    if (!requirementsResult.ok) return requirementsResult;

    const revisionBySection = new Map<string, typeof revisionsResult.value[number][]>();
    for (const revision of revisionsResult.value) {
      const list = revisionBySection.get(revision.sectionId) ?? [];
      list.push(revision);
      revisionBySection.set(revision.sectionId, list);
    }

    const sections = sectionsResult.value.map((section) => {
      const sectionClaims = claimsResult.value.filter((c) => c.sectionId === section.id);
      const revisions = (revisionBySection.get(section.id) ?? []).sort((a, b) => a.revisionNumber - b.revisionNumber);
      const currentRevision = revisions.find((r) => r.id === section.currentRevisionId) ?? null;
      const materialClaims = sectionClaims.filter((c) => c.materiality === "MATERIAL" || c.materiality === undefined);
      const currentMaterial = materialClaims.filter(
        (c) => c.verificationResult === "PASSED" || c.verificationResult === "ACCEPTED_WITH_LIMITATION" || c.verificationResult === "EXCLUDED",
      ).length;
      return {
        sectionId: section.id,
        sectionTitle: section.sectionTitle,
        status: section.status,
        revisionNumber: currentRevision?.revisionNumber ?? null,
        revisionId: section.currentRevisionId ?? null,
        assuranceState: currentRevision?.assuranceState ?? "UNASSESSED",
        coverage: {
          totalClaims: sectionClaims.length,
          materialClaims: materialClaims.length,
          currentMaterial: currentMaterial,
          complete: materialClaims.length > 0 ? currentMaterial === materialClaims.length : section.content.trim().length === 0,
        },
        claims: sectionClaims.map((c) => ({
          id: c.id,
          text: c.text,
          type: c.type,
          verificationResult: c.verificationResult,
          verificationReasonCode: c.verificationReasonCode,
          verificationDetail: c.verificationDetail,
          materiality: c.materiality,
          resolvedById: c.resolvedById,
          resolutionNotes: c.resolutionNotes,
        })),
        revisionHistory: revisions.map((r) => ({
          id: r.id,
          revisionNumber: r.revisionNumber,
          changeOrigin: r.changeOrigin,
          assuranceState: r.assuranceState,
          createdAt: r.createdAt,
        })),
      };
    });

    return {
      ok: true,
      value: {
        draftId,
        reportingPeriodId: draft.reportingPeriodId,
        status: draft.status,
        sections,
        requirements: requirementsResult.value
          ? {
              id: requirementsResult.value.id,
              coverage: requirementsResult.value.coverage,
              sourceTrace: requirementsResult.value.sourceTrace,
            }
          : null,
      },
    };
  }
}
