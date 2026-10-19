import type { IPlanContextReader } from "@donordesk/application";
import { ok, toPlainDate } from "@donordesk/domain";
import type { PlainDate, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";
import { toDate, toDay } from "./plan-dates.js";

/** Members, report use and project dates for the plan rules. */
export class PrismaPlanContextReader implements IPlanContextReader {
  constructor(private readonly prisma: PrismaClient) {}

  async activeMemberIds(projectId: string, tenantId: TenantId) {
    const rows = await this.prisma.projectMember.findMany({ where: { projectId, tenantId: tenantId.toString(), status: "ACTIVE" }, select: { userId: true } });
    return ok(new Set(rows.map((r) => r.userId)) as ReadonlySet<string>);
  }

  async reportUsesDates(projectId: string, tenantId: TenantId, range: { start: PlainDate; end: PlainDate }) {
    const periods = await this.prisma.reportingPeriod.findMany({
      where: { projectId, tenantId: tenantId.toString(), cancelledAt: null, startDate: { lte: toDate(range.end) }, endDate: { gte: toDate(range.start) } },
      select: { id: true },
    });
    if (periods.length === 0) return ok(false);
    const drafts = await this.prisma.reportDraft.count({ where: { tenantId: tenantId.toString(), reportingPeriodId: { in: periods.map((p) => p.id) } } });
    return ok(drafts > 0);
  }

  async reportCoveredRanges(projectId: string, tenantId: TenantId) {
    const periods = await this.prisma.reportingPeriod.findMany({ where: { projectId, tenantId: tenantId.toString(), cancelledAt: null }, select: { id: true, startDate: true, endDate: true } });
    if (periods.length === 0) return ok([] as Array<{ start: PlainDate; end: PlainDate }>);
    const drafts = await this.prisma.reportDraft.findMany({ where: { tenantId: tenantId.toString(), reportingPeriodId: { in: periods.map((p) => p.id) } }, select: { reportingPeriodId: true }, distinct: ["reportingPeriodId"] });
    const withDraft = new Set(drafts.map((d) => d.reportingPeriodId));
    return ok(periods.filter((p) => withDraft.has(p.id)).map((p) => ({ start: toDay(p.startDate), end: toDay(p.endDate) })));
  }

  async projectDates(projectId: string, tenantId: TenantId) {
    const p = await this.prisma.project.findFirst({ where: { id: projectId, tenantId: tenantId.toString() }, select: { startDate: true, endDate: true } });
    return ok(p ? { start: toPlainDate(p.startDate)!, end: toPlainDate(p.endDate)! } : null);
  }
}
