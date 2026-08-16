import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorUpdateRepository, IIndicatorRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { BulkUpsertIndicatorUpdatesInput } from "@donordesk/contracts";
import { upsertIndicatorUpdate } from "./upsert-indicator-update.js";

export class BulkUpsertIndicatorUpdatesHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly repo: IIndicatorUpdateRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: BulkUpsertIndicatorUpdatesInput): Promise<Result<{ saved: number; skipped: number }, DomainError>> {
    const periodResult = await this.periods.findById(input.reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    if (!periodResult.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", input.reportingPeriodId) };
    if (periodResult.value.status.value === "CLOSED") {
      return { ok: false, error: DomainError.conflict("Indicator data cannot be edited once a reporting period is closed") };
    }

    const indicatorsResult = await this.indicators.findByProject(periodResult.value.projectId, ctx.tenant.tenantId);
    if (!indicatorsResult.ok) return indicatorsResult;
    const validIndicatorIds = new Set(indicatorsResult.value.map((i) => i.id));

    let saved = 0;
    let skipped = 0;
    for (const row of input.updates) {
      if (!validIndicatorIds.has(row.indicatorId)) continue;
      const result = await upsertIndicatorUpdate(
        this.ids,
        this.repo,
        ctx.tenant.tenantId,
        ctx.tenant.userId,
        input.reportingPeriodId,
        row,
      );
      if (!result.ok) return result;
      if (result.value.changed) saved += 1;
      else skipped += 1;
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "logframe.indicator.updated",
        entityType: "indicator_update",
        entityId: result.value.id,
        newValue: row.periodAchievement,
      });
    }

    return { ok: true, value: { saved, skipped } };
  }
}
