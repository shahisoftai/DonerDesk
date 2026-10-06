import type { EvidenceFile, ReportingPeriod, Result, TenantId } from "@donordesk/domain";

/** The evidence a report covers (see `periodEvidenceMode`): the one answer generation, readiness, the inputs panel and the export wizard share. */
export interface IPeriodEvidenceScope {
  filesFor(
    tenantId: TenantId,
    period: Pick<ReportingPeriod, "id" | "projectId" | "reportType">,
    activityIds: ReadonlyArray<string>,
    options?: { verifiedOnly?: boolean },
  ): Promise<Result<EvidenceFile[]>>;
}
