import { ChecklistItem } from "@donordesk/domain";
import { stableFingerprint } from "@donordesk/domain";
import type { IUnsupportedClaimProjector, IChecklistRepository } from "@donordesk/application";
import type { IIdGenerator } from "@donordesk/application";
import type { Result, TenantId } from "@donordesk/domain";

/**
 * Projects material-assertion coverage gaps into existing
 * UNSUPPORTED_REPORT_CLAIM checklist items. Deterministic deduplication keys
 * (the stable assertion fingerprint) keep repeated re-assessment idempotent:
 * a gap that was ever created for the period — open or resolved — is not
 * recreated, so resolving an item is a permanent decision.
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
    // Deduplicate against every UNSUPPORTED_REPORT_CLAIM item ever created for
    // the period, not only open ones. A claim the user already resolved or
    // accepted is never recreated, even when the same assertion reappears
    // after an edit or regeneration.
    const seenKeys = new Set(
      existing.value
        .filter((i) => i.type === "UNSUPPORTED_REPORT_CLAIM")
        .map((i) => `${i.type}:${i.relatedEntityId ?? ""}`),
    );

    const seen = new Set<string>();
    for (const gap of input.gaps) {
      const dedupKey = stableFingerprint(gap.key);
      const key = `UNSUPPORTED_REPORT_CLAIM:${dedupKey}`;
      if (seenKeys.has(key) || seen.has(key)) continue;
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
