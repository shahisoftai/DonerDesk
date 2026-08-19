import { ChecklistItem } from "@donordesk/domain";
import { stableFingerprint } from "@donordesk/domain";
import type { IUnsupportedClaimProjector, IChecklistRepository } from "@donordesk/application";
import type { IIdGenerator } from "@donordesk/application";
import type { Result, TenantId } from "@donordesk/domain";

/**
 * Projects material-assertion coverage gaps into existing
 * UNSUPPORTED_REPORT_CLAIM checklist items. Deterministic deduplication keys
 * (the stable assertion fingerprint) keep repeated re-assessment idempotent:
 * an already-active gap is not recreated.
 */
export class ChecklistUnsupportedClaimProjector implements IUnsupportedClaimProjector {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly checklist: IChecklistRepository,
  ) {}

  async project(input: {
    tenantId: TenantId;
    periodId: string;
    projectId: string;
    gaps: Array<{ key: string; title: string; description: string }>;
  }): Promise<Result<void>> {
    if (input.gaps.length === 0) return { ok: true, value: undefined };

    const existing = await this.checklist.findByReportingPeriod(input.periodId, input.tenantId);
    if (!existing.ok) return existing;
    const activeKeys = new Set(
      existing.value
        .filter((i) => i.type === "UNSUPPORTED_REPORT_CLAIM" && (i.status === "OPEN" || i.status === "IN_PROGRESS"))
        .map((i) => `${i.type}:${i.relatedEntityId ?? ""}`),
    );

    const seen = new Set<string>();
    for (const gap of input.gaps) {
      const dedupKey = stableFingerprint(gap.key);
      const key = `UNSUPPORTED_REPORT_CLAIM:${dedupKey}`;
      if (activeKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      const item = ChecklistItem.create({
        id: this.ids.generate(),
        tenantId: input.tenantId.toString(),
        projectId: input.projectId,
        reportingPeriodId: input.periodId,
        type: "UNSUPPORTED_REPORT_CLAIM",
        title: gap.title,
        description: gap.description,
        severity: "HIGH",
        relatedEntityType: "report_claim",
        relatedEntityId: dedupKey,
      });
      const saved = await this.checklist.create(item);
      if (!saved.ok) return saved;
    }
    return { ok: true, value: undefined };
  }
}
