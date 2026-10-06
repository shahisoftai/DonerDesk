import type { ReportingPeriod, Result, TenantId } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";
import type { IEvidenceRepository } from "../ports/evidence.js";
import { PeriodEvidenceScope } from "./period-evidence-scope-service.js";

/**
 * Verified evidence a report covers: files tagged to the period or to one of its activities (all of the
 * project's for a roll-up report). Uploading a file with those tags is how most evidence arrives, so it
 * counts even when nobody attached it to a record as well.
 */
export async function taggedEvidenceIds(
  evidenceFiles: IEvidenceRepository | undefined,
  period: Pick<ReportingPeriod, "id" | "projectId" | "reportType">,
  activityIds: ReadonlyArray<string>,
  tenantId: TenantId,
): Promise<Result<string[], DomainError>> {
  if (!evidenceFiles) return { ok: true, value: [] };
  const found = await new PeriodEvidenceScope(evidenceFiles).filesFor(tenantId, period, activityIds, { verifiedOnly: true });
  if (!found.ok) return found;
  return { ok: true, value: found.value.map((f) => f.id) };
}
