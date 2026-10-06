import type { Result } from "@donordesk/domain";
import { DomainError, templateAppliesToReportType } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingPeriodRepository, IReportDraftRepository } from "../../ports/reporting.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IAuditLogger } from "../../ports/core.js";
import { serializeTemplateSnapshot } from "../../services/template-snapshot.js";

const FINISHED_DRAFT = new Set(["APPROVED", "EXPORTED", "SUBMITTED"]);

/**
 * Changes which template a period's report follows (or to none: the built-in structure). Before the first draft
 * it simply re-pins; after a draft it re-pins too but never regenerates by itself: the result says
 * `regenerateNeeded`, and regenerating stays the user's explicit action. A finished report is not changed.
 */
export class ChangePeriodTemplateHandler {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly templates: IDonorTemplateRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    input: { reportingPeriodId: string; donorTemplateId: string | null },
  ): Promise<Result<{ changed: boolean; regenerateNeeded: boolean }, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const found = await this.periods.findById(input.reportingPeriodId, tenantId);
    if (!found.ok) return found;
    const period = found.value;
    if (!period) return { ok: false, error: DomainError.notFound("ReportingPeriod", input.reportingPeriodId) };

    const wanted = input.donorTemplateId ?? undefined;
    if (wanted === period.donorTemplateId) return { ok: true, value: { changed: false, regenerateNeeded: false } };

    const drafts = await this.drafts.findByReportingPeriod(period.id, tenantId);
    if (!drafts.ok) return drafts;
    if (drafts.value.some((d) => FINISHED_DRAFT.has(d.status))) {
      return { ok: false, error: DomainError.invalidTransition("This report is already approved. Reopen it before changing its template.") };
    }

    let snapshotJson = "{}";
    if (wanted) {
      const template = await this.templates.findById(wanted, tenantId);
      if (!template.ok) return template;
      if (!template.value || template.value.projectId !== period.projectId) return { ok: false, error: DomainError.notFound("DonorTemplate", wanted) };
      if (!templateAppliesToReportType(period.reportType, template.value.reportType)) {
        return { ok: false, error: DomainError.validation(`This template is for ${template.value.reportType.toLowerCase()} reports and cannot structure a ${period.reportType.toLowerCase()} report.`) };
      }
      if (!template.value.isReviewed) {
        return { ok: false, error: DomainError.validation("Approve this template (Templates → Approve template) before using it for a report.") };
      }
      snapshotJson = serializeTemplateSnapshot(template.value);
    }

    const previous = period.donorTemplateId;
    period.changeTemplate(wanted, snapshotJson);
    const saved = await this.periods.update(period);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting_period.template_changed",
      entityType: "reporting_period",
      entityId: period.id,
      projectId: period.projectId,
      oldValue: previous ?? "none",
      newValue: wanted ?? "none",
    });
    return { ok: true, value: { changed: true, regenerateNeeded: drafts.value.length > 0 } };
  }
}
