import type { PrismaClient } from "@prisma/client";
import { ok, type DomainError, type Result, type TenantId } from "@donordesk/domain";
import type { IPortfolioValueReader, PortfolioIndicatorRow } from "@donordesk/application";

/** A number as typed, or null: "1,200" is 1200, "" and text are not numbers. */
export function parseAmount(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const cleaned = text.replace(/[,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Latest verified value per live indicator, across the given projects. Reads only; the visibility check is in the handler. */
export class PrismaPortfolioValueReader implements IPortfolioValueReader {
  constructor(private readonly prisma: PrismaClient) {}

  async indicatorValues(projectIds: string[], tenantId: TenantId): Promise<Result<PortfolioIndicatorRow[], DomainError>> {
    const tenant = tenantId.toString();
    const [indicators, projects] = await Promise.all([
      this.prisma.indicator.findMany({ where: { tenantId: tenant, projectId: { in: projectIds }, archivedAt: null }, select: { id: true, projectId: true, code: true, name: true, type: true, unit: true, target: true, countedElsewhere: true } }),
      this.prisma.project.findMany({ where: { tenantId: tenant, id: { in: projectIds } }, select: { id: true, title: true, donorName: true, country: true, startDate: true, endDate: true } }),
    ]);
    if (indicators.length === 0) return ok([]);
    const updates = await this.prisma.indicatorUpdate.findMany({
      where: { tenantId: tenant, indicatorId: { in: indicators.map((i) => i.id) }, verificationStatus: "VERIFIED" },
      select: { indicatorId: true, cumulativeAchievement: true, reportingPeriodId: true },
    });
    const periods = await this.prisma.reportingPeriod.findMany({
      where: { tenantId: tenant, id: { in: [...new Set(updates.map((u) => u.reportingPeriodId))] } },
      select: { id: true, endDate: true },
    });
    const endById = new Map(periods.map((p) => [p.id, p.endDate.toISOString().slice(0, 10)]));
    // The latest verified period per indicator wins.
    const latest = new Map<string, { value: number | null; asOf: string }>();
    for (const u of updates) {
      const asOf = endById.get(u.reportingPeriodId);
      if (!asOf) continue;
      const current = latest.get(u.indicatorId);
      if (!current || asOf > current.asOf) latest.set(u.indicatorId, { value: parseAmount(u.cumulativeAchievement), asOf });
    }
    const titles = new Map(projects.map((p) => [p.id, p]));
    return ok(indicators.map((i) => {
      const project = titles.get(i.projectId);
      const v = latest.get(i.id);
      return {
        projectId: i.projectId, projectTitle: project?.title ?? "", donorName: project?.donorName ?? "",
        indicatorCode: i.code, indicatorName: i.name, unit: i.unit ?? null, type: i.type, target: parseAmount(i.target),
        verifiedCumulative: v?.value ?? null, verifiedAsOf: v?.asOf ?? null,
        countedElsewhere: i.countedElsewhere, country: project?.country ?? "",
        startDate: project?.startDate.toISOString().slice(0, 10) ?? "", endDate: project?.endDate.toISOString().slice(0, 10) ?? "",
      };
    }));
  }
}
