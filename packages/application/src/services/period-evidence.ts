import type { ReportingPeriod, Result, TenantId } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";
import type { IEvidenceRepository } from "../ports/evidence.js";

/**
 * Verified evidence tagged to the period or to one of the report's activities. Uploading a file with those
 * tags is how most evidence arrives, so it counts even when nobody attached it to a record as well.
 */
export async function taggedEvidenceIds(
  evidenceFiles: IEvidenceRepository | undefined,
  period: Pick<ReportingPeriod, "id" | "projectId">,
  activityIds: ReadonlyArray<string>,
  tenantId: TenantId,
): Promise<Result<string[], DomainError>> {
  if (!evidenceFiles) return { ok: true, value: [] };
  const found = await evidenceFiles.search({ projectId: period.projectId, reportingPeriodId: period.id, verificationStatus: "VERIFIED", page: 1, pageSize: 200 }, tenantId);
  if (!found.ok) return found;
  const ids = new Set(found.value.items.map((e) => e.id));
  const wanted = new Set(activityIds);
  if (wanted.size > 0) {
    const byProject = await evidenceFiles.search({ projectId: period.projectId, verificationStatus: "VERIFIED", page: 1, pageSize: 200 }, tenantId);
    if (!byProject.ok) return byProject;
    for (const e of byProject.value.items) if (e.activityId && wanted.has(e.activityId)) ids.add(e.id);
  }
  return { ok: true, value: [...ids] };
}
