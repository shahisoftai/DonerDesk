import type { Result } from "@donordesk/domain";
import { DomainError, describeEntryWindow, validateEntryWindow } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Sets, changes or clears the window in which a period's values may be entered (Phase 33.4). Needs `project.edit` (the
 * permission the other period lifecycle changes use) — checked by the route's authorization rule. Clearing is an empty
 * window. A locked report keeps its window as it was (nothing about it can change now). Audited.
 */
export class SetPeriodEntryWindowHandler {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly audit: IAuditLogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handle(ctx: AuthenticatedContext, periodId: string, input: { opensOn?: string | null; closesOn?: string | null }): Promise<Result<{ opensOn?: string; closesOn?: string; description: string | null }, DomainError>> {
    const window = validateEntryWindow(input);
    if (!window.ok) return window;
    const found = await this.periods.findById(periodId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const period = found.value;
    if (!period) return { ok: false, error: DomainError.notFound("ReportingPeriod", periodId) };
    if (period.isCancelled) return { ok: false, error: DomainError.conflict("This period is cancelled; bring it back before changing it") };
    const before = JSON.stringify({ opensOn: period.entryOpensOn ?? null, closesOn: period.entryClosesOn ?? null });
    period.setEntryWindow(window.value);
    const saved = await this.periods.update(period);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "period.entry_window_set", entityType: "reporting_period", entityId: periodId, projectId: period.projectId,
      oldValue: before, newValue: JSON.stringify({ opensOn: window.value.opensOn ?? null, closesOn: window.value.closesOn ?? null }),
    });
    return { ok: true, value: { ...window.value, description: describeEntryWindow(window.value, this.now().toISOString().slice(0, 10)) } };
  }
}
