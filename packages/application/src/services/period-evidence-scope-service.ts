import { isEvidenceInPeriodScope, periodEvidenceMode } from "@donordesk/domain";
import type { EvidenceFile, ReportingPeriod, Result, TenantId } from "@donordesk/domain";
import type { IEvidenceRepository } from "../ports/evidence.js";
import type { IPeriodEvidenceScope } from "../ports/period-evidence-scope.js";

const PAGE_SIZE = 200;

/** Applies the domain's evidence scope to a repository, reading every page so a large project is never silently truncated. */
export class PeriodEvidenceScope implements IPeriodEvidenceScope {
  constructor(private readonly evidence: IEvidenceRepository) {}

  async filesFor(
    tenantId: TenantId,
    period: Pick<ReportingPeriod, "id" | "projectId" | "reportType">,
    activityIds: ReadonlyArray<string>,
    options: { verifiedOnly?: boolean } = {},
  ): Promise<Result<EvidenceFile[]>> {
    const scope = { mode: periodEvidenceMode(period.reportType), periodId: period.id, activityIds: new Set(activityIds) };
    const files: EvidenceFile[] = [];
    for (let page = 1; ; page += 1) {
      const found = await this.evidence.search(
        { projectId: period.projectId, ...(options.verifiedOnly ? { verificationStatus: "VERIFIED" as const } : {}), page, pageSize: PAGE_SIZE },
        tenantId,
      );
      if (!found.ok) return found;
      files.push(...found.value.items.filter((f) => isEvidenceInPeriodScope(f, scope)));
      if (found.value.items.length < PAGE_SIZE || page * PAGE_SIZE >= found.value.total) break;
    }
    return { ok: true, value: files };
  }
}
