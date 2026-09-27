import { DomainError, type ReportingPeriod, type Result, type TenantId } from "@donordesk/domain";
import type { IDonorTemplateRepository } from "../ports/templates.js";
import type { IReportingPeriodRepository } from "../ports/reporting.js";
import { parseTemplateSnapshot, serializeTemplateSnapshot, snapshotFromTemplate, type PeriodTemplateSnapshot } from "./template-snapshot.js";

/**
 * Decides which donor template version a period's report follows.
 * - `pinned`: the snapshot frozen on the period (section regenerate/rewrite).
 * - `latest`: the current template, which must be reviewed; it is re-pinned
 *   onto the period (a full draft adopts the latest reviewed structure).
 * Legacy periods without a versioned snapshot fall back to the live template.
 */
export class PeriodTemplateResolver {
  constructor(private readonly templates: IDonorTemplateRepository, private readonly periods: IReportingPeriodRepository) {}

  async resolve(period: ReportingPeriod, tenantId: TenantId, mode: "pinned" | "latest"): Promise<Result<PeriodTemplateSnapshot | undefined, DomainError>> {
    if (!period.donorTemplateId) return { ok: true, value: undefined };
    if (mode === "pinned") {
      const pinned = parseTemplateSnapshot(period.templateSnapshotJson);
      if (pinned && pinned.id === period.donorTemplateId && pinned.sections.length > 0) return { ok: true, value: pinned };
    }
    const found = await this.templates.findById(period.donorTemplateId, tenantId);
    if (!found.ok) return found;
    const template = found.value;
    if (!template) return { ok: true, value: undefined };
    if (mode === "pinned") return { ok: true, value: snapshotFromTemplate(template) };

    if (!template.isReviewed) {
      return {
        ok: false,
        error: DomainError.reportGateBlocked(
          template.status === "EXTRACTING"
            ? "The donor template is still being analysed. Try again in a moment."
            : "Review the donor template and approve it (Templates → Approve template) before generating the report.",
          { templateId: template.id, status: template.status },
        ),
      };
    }
    const current = parseTemplateSnapshot(period.templateSnapshotJson);
    if (!current || current.id !== template.id || current.version !== template.version) {
      period.setSnapshots(period.reportingProfileSnapshotJson, serializeTemplateSnapshot(template));
      const saved = await this.periods.update(period);
      if (!saved.ok) return saved;
    }
    return { ok: true, value: snapshotFromTemplate(template) };
  }
}
