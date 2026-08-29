import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportDraftRepository,
  IReportSectionRepository,
  IReportClaimRepository,
  IReportPlanRepository,
  IReportArtifactRepository,
} from "../../ports/reporting.js";

export class GetReportDraftHandler {
  constructor(
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly claims: IReportClaimRepository,
    private readonly plans: IReportPlanRepository,
    private readonly reportArtifacts?: IReportArtifactRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<unknown, DomainError>> {
    const draftsResult = await this.drafts.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!draftsResult.ok) return draftsResult;
    const draft = draftsResult.value[0];
    if (!draft) {
      return { ok: true, value: { draft: null, sections: [], claims: [], plan: null, artifacts: {} } };
    }

    const sectionsResult = await this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId);
    if (!sectionsResult.ok) return sectionsResult;
    const claimsResult = await this.claims.findByDraft(draft.id, ctx.tenant.tenantId);
    if (!claimsResult.ok) return claimsResult;
    const plansResult = await this.plans.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!plansResult.ok) return plansResult;

    const sorted = [...sectionsResult.value].sort((a, b) => a.sectionOrder - b.sectionOrder);

    // AI Reporter 2 — fetch typed artifacts per section in one batch.
    const artifactsBySection: Record<string, unknown> = {};
    if (this.reportArtifacts) {
      for (const section of sorted) {
        const r = await this.reportArtifacts.findBySection(section.id, ctx.tenant.tenantId);
        if (r.ok && r.value.length > 0) {
          artifactsBySection[section.id] = r.value.map((art) => ({
            id: art.id,
            kind: art.kind,
            ordinal: art.ordinal,
            caption: art.caption,
            payload: art.payload,
            sourceReferences: art.sourceReferences,
            rows: art.rows,
            createdAt: art.createdAt.toISOString(),
          }));
        }
      }
    }

    return {
      ok: true,
      value: {
        draft: {
          id: draft.id,
          title: draft.title,
          status: draft.status,
          version: draft.version,
          generatedByAi: draft.generatedByAi,
          createdById: draft.createdById,
          approvedById: draft.approvedById,
          approvedAt: draft.approvedAt?.toISOString(),
        },
        sections: sorted.map((s) => ({
          id: s.id,
          sectionTitle: s.sectionTitle,
          sectionOrder: s.sectionOrder,
          content: s.content,
          sourceReferences: s.sourceReferences,
          unsupportedClaims: s.unsupportedClaims,
          status: s.status,
          chartConfig: s.chartConfig,
          updatedAt: s.updatedAt.toISOString(),
        })),
        claims: claimsResult.value.map((c) => ({
          id: c.id,
          sectionId: c.sectionId,
          text: c.text,
          type: c.type,
          sources: c.sources,
          verificationResult: c.verificationResult,
          verificationDetail: c.verificationDetail,
          resolutionNotes: c.resolutionNotes,
          resolvedById: c.resolvedById,
          resolvedAt: c.resolvedAt?.toISOString(),
        })),
        plan: plansResult.value[0] ?? null,
        artifacts: artifactsBySection,
      },
    };
  }
}
