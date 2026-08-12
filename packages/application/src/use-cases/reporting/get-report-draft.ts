import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository, IReportSectionRepository } from "../../ports/reporting.js";

export class GetReportDraftHandler {
  constructor(
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<unknown, DomainError>> {
    const draftsResult = await this.drafts.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!draftsResult.ok) return draftsResult;
    const draft = draftsResult.value[0];
    if (!draft) {
      return { ok: true, value: { draft: null, sections: [] } };
    }

    const sectionsResult = await this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId);
    if (!sectionsResult.ok) return sectionsResult;

    const sorted = [...sectionsResult.value].sort((a, b) => a.sectionOrder - b.sectionOrder);

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
          updatedAt: s.updatedAt.toISOString(),
        })),
      },
    };
  }
}
