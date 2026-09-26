import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IDonorTemplateMappingRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * First real caller of `ReportingPeriod.lockDonorTemplateMapping()` (the
 * method has existed since the original professional-reporting plan but had
 * zero call sites until this handler). Locks an approved donor-template
 * mapping version to a reporting period so `buildDonorTemplate()` knows to
 * render into the donor's real template for every export of this period.
 */
export class LockTemplateMappingHandler {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly mappings: IDonorTemplateMappingRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    input: { reportingPeriodId: string; mappingId: string },
  ): Promise<Result<{ reportingPeriodId: string; mappingVersion: number }, DomainError>> {
    const period = await this.periods.findById(input.reportingPeriodId, ctx.tenant.tenantId);
    if (!period.ok) return period;
    if (!period.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", input.reportingPeriodId) };

    const mapping = await this.mappings.findById(input.mappingId, ctx.tenant.tenantId);
    if (!mapping.ok) return mapping;
    if (!mapping.value) return { ok: false, error: DomainError.notFound("DonorTemplateMapping", input.mappingId) };
    if (!mapping.value.approvedAt) {
      return { ok: false, error: DomainError.reportTemplateMappingMissing("Cannot lock an unapproved donor template mapping to a reporting period") };
    }
    if (period.value.donorTemplateId && mapping.value.templateId !== period.value.donorTemplateId) {
      return { ok: false, error: DomainError.validation("Mapping belongs to a different donor template than the one attached to this reporting period") };
    }

    try {
      period.value.lockDonorTemplateMapping(mapping.value.version, mapping.value.id);
    } catch (error) {
      return { ok: false, error: error instanceof DomainError ? error : DomainError.validation(String(error)) };
    }

    const saved = await this.periods.update(period.value);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting_period.template_mapping_locked",
      entityType: "reporting_period",
      entityId: input.reportingPeriodId,
      newValue: `mappingId=${mapping.value.id};version=${mapping.value.version}`,
    });

    return { ok: true, value: { reportingPeriodId: input.reportingPeriodId, mappingVersion: mapping.value.version } };
  }
}
