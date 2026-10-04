import type { ReportScope, Result, ReportDraftStatus } from "@donordesk/domain";
import { DomainError, SCOPED_REPORT_TYPES } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository, IReportRevisionRepository, IReportSectionRepository, IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IAuditLogger } from "../../ports/core.js";
import { ReportScopeResolver } from "../../services/report-scope-resolver.js";

export interface UpdateReportingPeriodScopeInput {
  scope: unknown;
}

export interface UpdateReportingPeriodScopeResult {
  scope: ReportScope;
  /** Whether the scope actually changed. */
  changed: boolean;
  /** Draft sections whose assurance was marked STALE because they were written for the old scope. */
  staleSections: number;
}

/** A report in one of these states is being, or has been, reviewed or released: its scope is frozen. */
const FROZEN_DRAFT_STATUSES: ReadonlySet<ReportDraftStatus> = new Set(["UNDER_REVIEW", "APPROVED", "EXPORTED", "SUBMITTED"]);

/**
 * Changes what an activity, situation or custom report covers after it was
 * created. The scope is re-validated like at creation. Sections already drafted
 * were written for the old scope, so their assurance is marked STALE (which
 * blocks approval until they are regenerated and re-checked); nothing is
 * regenerated automatically because that spends AI credits and would overwrite edits.
 */
export class UpdateReportingPeriodScopeHandler {
  private readonly scopes: ReportScopeResolver;

  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly revisions: IReportRevisionRepository,
    activities: IActivityUpdateRepository,
    private readonly audit: IAuditLogger,
  ) {
    this.scopes = new ReportScopeResolver(periods, activities);
  }

  async handle(ctx: AuthenticatedContext, periodId: string, input: UpdateReportingPeriodScopeInput): Promise<Result<UpdateReportingPeriodScopeResult, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const found = await this.periods.findById(periodId, tenantId);
    if (!found.ok) return found;
    const period = found.value;
    if (!period) return { ok: false, error: DomainError.notFound("ReportingPeriod", periodId) };
    if (!SCOPED_REPORT_TYPES.has(period.reportType)) {
      return { ok: false, error: DomainError.validation(`A ${period.reportType.toLowerCase().replace(/_/g, " ")} report has no scope to edit`) };
    }

    const drafts = await this.drafts.findByReportingPeriod(periodId, tenantId);
    if (!drafts.ok) return drafts;
    const frozen = drafts.value.find((d) => FROZEN_DRAFT_STATUSES.has(d.status));
    if (frozen) {
      return { ok: false, error: DomainError.invalidTransition(`The scope cannot be changed while the report is ${frozen.status.toLowerCase().replace(/_/g, " ")}`) };
    }

    const resolved = await this.scopes.resolve({
      reportType: period.reportType,
      scope: input.scope,
      projectId: period.projectId,
      tenantId,
      existing: { periodId, scope: period.scope },
    });
    if (!resolved.ok) return resolved;
    const scope = resolved.value;

    const before = period.scope;
    if (JSON.stringify(scope) === JSON.stringify(before)) return { ok: true, value: { scope, changed: false, staleSections: 0 } };

    period.setScope(scope);
    const saved = await this.periods.update(period);
    if (!saved.ok) return saved;

    const stale = await this.markDraftedSectionsStale(drafts.value.map((d) => d.id), tenantId);
    if (!stale.ok) return stale;

    await this.audit.record({
      tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting_period.scope_updated",
      entityType: "reporting_period",
      entityId: periodId,
      projectId: period.projectId,
      oldValue: JSON.stringify({ scope: before }),
      newValue: JSON.stringify({ scope, staleSections: stale.value }),
    });
    return { ok: true, value: { scope, changed: true, staleSections: stale.value } };
  }

  private async markDraftedSectionsStale(draftIds: string[], tenantId: AuthenticatedContext["tenant"]["tenantId"]): Promise<Result<number, DomainError>> {
    let count = 0;
    for (const draftId of draftIds) {
      const sections = await this.sections.findByReportDraft(draftId, tenantId);
      if (!sections.ok) return sections;
      for (const section of sections.value) {
        const current = await this.revisions.findCurrentForSection(section.id, tenantId);
        if (!current.ok) return current;
        const revision = current.value;
        // UNASSESSED and FAILED revisions already require review; only trusted ones need invalidating.
        if (!revision || (revision.assuranceState !== "CURRENT" && revision.assuranceState !== "ASSESSING")) continue;
        revision.markStale();
        const updated = await this.revisions.update(revision);
        if (!updated.ok) return updated;
        count += 1;
      }
    }
    return { ok: true, value: count };
  }
}
