import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository, EvidenceFilter } from "../../ports/evidence.js";

export class SearchEvidenceHandler {
  constructor(private readonly repo: IEvidenceRepository) {}

  async handle(ctx: AuthenticatedContext, filter: EvidenceFilter): Promise<Result<{ items: unknown[]; total: number; page: number; pageSize: number }, DomainError>> {
    const r = await this.repo.search(filter, ctx.tenant.tenantId);
    if (!r.ok) return r;
    return {
      ok: true,
      value: {
        items: r.value.items.map((e) => ({
          id: e.id,
          projectId: e.projectId,
          reportingPeriodId: e.reportingPeriodId,
          activityId: e.activityId,
          indicatorId: e.indicatorId,
          fileName: e.fileName,
          title: e.title,
          fileType: e.fileType,
          fileSize: e.fileSize,
          evidenceType: e.evidenceType,
          location: e.location,
          activityDate: e.activityDate?.toISOString(),
          uploadedById: e.uploadedById,
          verificationStatus: e.verificationStatus,
          confidentialityLevel: e.confidentialityLevel,
          notes: e.notes,
          aiSummary: e.aiSummary,
          aiSuggestedTags: e.aiSuggestedTags,
          sensitivityWarning: e.sensitivityWarning,
        })),
        total: r.value.total,
        page: r.value.page,
        pageSize: r.value.pageSize,
      },
    };
  }
}
