import type { ReportingPeriod, Result, PeriodFact } from "@donordesk/domain";
import { DomainError, checkCancelPeriod, checkConvertToFinal, checkRestorePeriod, findCadenceOverlap } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository, IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface PeriodLifecycleResult {
  periodId: string;
  reportType: string;
  cancelled: boolean;
}

const toFact = (p: ReportingPeriod): PeriodFact => ({ id: p.id, reportType: p.reportType, start: p.duration.start, end: p.duration.end });

/** What the three lifecycle handlers share: the period, its sibling periods and the status of its reports. */
class PeriodLifecycleContext {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly drafts: IReportDraftRepository,
  ) {}

  async load(ctx: AuthenticatedContext, periodId: string): Promise<Result<{ period: ReportingPeriod; others: PeriodFact[]; draftStatuses: string[] }, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const found = await this.periods.findById(periodId, tenantId);
    if (!found.ok) return found;
    const period = found.value;
    if (!period) return { ok: false, error: DomainError.notFound("ReportingPeriod", periodId) };
    const siblings = await this.periods.findByProject(period.projectId, tenantId);
    if (!siblings.ok) return siblings;
    const drafts = await this.drafts.findByReportingPeriod(periodId, tenantId);
    if (!drafts.ok) return drafts;
    return {
      ok: true,
      value: {
        period,
        others: siblings.value.filter((p) => p.id !== periodId).map(toFact),
        draftStatuses: drafts.value.map((d) => d.status),
      },
    };
  }
}

/**
 * Takes a period out of the calendar without deleting anything: its data stays, it no longer blocks the dates, the
 * closing report or comparisons. Refused while a report on it is approved or sent.
 */
export class CancelReportingPeriodHandler {
  private readonly lifecycle: PeriodLifecycleContext;

  constructor(
    private readonly periods: IReportingPeriodRepository,
    drafts: IReportDraftRepository,
    private readonly audit: IAuditLogger,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.lifecycle = new PeriodLifecycleContext(periods, drafts);
  }

  async handle(ctx: AuthenticatedContext, periodId: string, input: { reason?: string } = {}): Promise<Result<PeriodLifecycleResult, DomainError>> {
    const loaded = await this.lifecycle.load(ctx, periodId);
    if (!loaded.ok) return loaded;
    const { period, draftStatuses } = loaded.value;
    const check = checkCancelPeriod({ cancelled: period.isCancelled, draftStatuses });
    if (!check.ok) return { ok: false, error: DomainError.invalidTransition(check.reason) };

    period.cancel(input.reason, this.now());
    const saved = await this.periods.update(period);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting_period.cancelled",
      entityType: "reporting_period",
      entityId: periodId,
      projectId: period.projectId,
      newValue: JSON.stringify({ reportType: period.reportType, reason: period.cancelReason ?? null }),
    });
    return { ok: true, value: { periodId, reportType: period.reportType, cancelled: true } };
  }
}

/** Puts a cancelled period back, unless another period now covers its dates. */
export class RestoreReportingPeriodHandler {
  private readonly lifecycle: PeriodLifecycleContext;

  constructor(
    private readonly periods: IReportingPeriodRepository,
    drafts: IReportDraftRepository,
    private readonly audit: IAuditLogger,
  ) {
    this.lifecycle = new PeriodLifecycleContext(periods, drafts);
  }

  async handle(ctx: AuthenticatedContext, periodId: string): Promise<Result<PeriodLifecycleResult, DomainError>> {
    const loaded = await this.lifecycle.load(ctx, periodId);
    if (!loaded.ok) return loaded;
    const { period, others } = loaded.value;
    const check = checkRestorePeriod({
      cancelled: period.isCancelled,
      overlapping: findCadenceOverlap(period.reportType, { start: period.duration.start, end: period.duration.end }, others),
    });
    if (!check.ok) return { ok: false, error: DomainError.invalidTransition(check.reason) };

    period.restore();
    const saved = await this.periods.update(period);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting_period.restored",
      entityType: "reporting_period",
      entityId: periodId,
      projectId: period.projectId,
    });
    return { ok: true, value: { periodId, reportType: period.reportType, cancelled: false } };
  }
}

/**
 * Turns the closing regular period into the Final report (the repair for a final month created as a regular month).
 * The same checks as creation: the last block, no other final, nothing approved on it.
 */
export class ConvertPeriodToFinalHandler {
  private readonly lifecycle: PeriodLifecycleContext;

  constructor(
    private readonly periods: IReportingPeriodRepository,
    drafts: IReportDraftRepository,
    private readonly audit: IAuditLogger,
  ) {
    this.lifecycle = new PeriodLifecycleContext(periods, drafts);
  }

  async handle(ctx: AuthenticatedContext, periodId: string): Promise<Result<PeriodLifecycleResult, DomainError>> {
    const loaded = await this.lifecycle.load(ctx, periodId);
    if (!loaded.ok) return loaded;
    const { period, others, draftStatuses } = loaded.value;
    const check = checkConvertToFinal({ period: toFact(period), cancelled: period.isCancelled, others, draftStatuses });
    if (!check.ok) return { ok: false, error: DomainError.invalidTransition(check.reason) };

    const before = period.reportType;
    period.convertToFinal();
    const saved = await this.periods.update(period);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting_period.converted_to_final",
      entityType: "reporting_period",
      entityId: periodId,
      projectId: period.projectId,
      oldValue: JSON.stringify({ reportType: before }),
      newValue: JSON.stringify({ reportType: "FINAL" }),
    });
    return { ok: true, value: { periodId, reportType: "FINAL", cancelled: false } };
  }
}
