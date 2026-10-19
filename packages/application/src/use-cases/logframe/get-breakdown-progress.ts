import { DomainError, breakdownProgress, err, ok, type BreakdownProgressRow, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IPlanContextReader } from "../../ports/workplan.js";

export interface BreakdownProgressIndicator {
  indicatorId: string;
  code: string;
  name: string;
  unit: string | null;
  type: string;
  rows: BreakdownProgressRow[];
}

/**
 * For each indicator that has targets by group, the target beside the verified figure so far. For people on the project or an admin.
 * Only verified values count; a group nobody reported is blank, never zero.
 */
export class GetBreakdownProgressHandler {
  constructor(
    private readonly indicators: IIndicatorRepository, private readonly updates: IIndicatorUpdateRepository,
    private readonly periods: IReportingPeriodRepository, private readonly context: IPlanContextReader,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<BreakdownProgressIndicator[], DomainError>> {
    if (ctx.tenant.role !== "ADMIN") {
      const members = await this.context.activeMemberIds(projectId, ctx.tenant.tenantId);
      if (!members.ok) return members;
      if (!members.value.has(ctx.tenant.userId)) return err(DomainError.forbidden("You are not on this project"));
    }
    const all = await this.indicators.findByProject(projectId, ctx.tenant.tenantId);
    if (!all.ok) return all;
    const withTargets = all.value.filter((i) => i.targetBreakdowns.length > 0);
    if (withTargets.length === 0) return ok([]);
    const periods = await this.periods.findByProject(projectId, ctx.tenant.tenantId);
    if (!periods.ok) return periods;
    const periodEnd = new Map(periods.value.map((p) => [p.id, p.duration.end.toISOString().slice(0, 10)]));

    const out: BreakdownProgressIndicator[] = [];
    for (const ind of withTargets) {
      const updates = await this.updates.findByIndicator(ind.id, ctx.tenant.tenantId);
      if (!updates.ok) return updates;
      out.push({
        indicatorId: ind.id, code: ind.code, name: ind.name, unit: ind.unit ?? null, type: ind.type,
        rows: breakdownProgress({
          type: ind.type, targets: ind.targetBreakdowns,
          updates: updates.value.flatMap((u) => {
            const end = periodEnd.get(u.reportingPeriodId);
            return end ? [{ periodEnd: end, verified: u.verificationStatus === "VERIFIED", entries: u.disaggregation }] : [];
          }),
        }),
      });
    }
    return ok(out.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
  }
}
