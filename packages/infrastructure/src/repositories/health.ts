import type { PrismaClient } from "@prisma/client";
import { DEFAULT_ENTRY_DUE_DAYS, ProjectRiskTrend, ok, recordedKey, type PlainDate, type RiskFactor, type TenantId } from "@donordesk/domain";
import type { CollectionFacts, ICollectionFactsReader, IEntryDueDays, IEntryDueDaysWriter, IRiskTrendStore } from "@donordesk/application";

const toDay = (d: Date): PlainDate => d.toISOString().slice(0, 10);
/** A report that is finished takes no more values. */
const FINISHED = ["APPROVED", "EXPORTED", "SENT", "SUBMITTED", "CLOSED"];
const ACTIVE_PROJECT = ["ACTIVE", "DRAFT", "PAUSED"];

/** What is needed to tell which indicator values are due, read once per project. */
export class PrismaCollectionFactsReader implements ICollectionFactsReader {
  constructor(private readonly prisma: PrismaClient) {}

  async forProjects(tenantId: TenantId, projectIds?: ReadonlyArray<string>) {
    const tenant = tenantId.toString();
    const projects = await this.prisma.project.findMany({
      where: { tenantId: tenant, archivedAt: null, status: { in: ACTIVE_PROJECT }, ...(projectIds ? { id: { in: [...projectIds] } } : {}) },
      select: { id: true, title: true, startDate: true, meOfficerId: true, projectManagerId: true },
    });
    if (projects.length === 0) return ok([] as CollectionFacts[]);
    const ids = projects.map((p) => p.id);
    const [profiles, indicators, periods] = await Promise.all([
      this.prisma.reportingProfile.findMany({ where: { tenantId: tenant, projectId: { in: ids } }, select: { projectId: true, indicatorEntryDueDays: true } }),
      this.prisma.indicator.findMany({ where: { tenantId: tenant, projectId: { in: ids }, archivedAt: null }, select: { id: true, projectId: true, code: true, name: true, frequency: true, responsibleUserId: true } }),
      this.prisma.reportingPeriod.findMany({ where: { tenantId: tenant, projectId: { in: ids }, cancelledAt: null, status: { notIn: FINISHED } }, select: { id: true, projectId: true, reportType: true, startDate: true, endDate: true }, orderBy: { startDate: "asc" } }),
    ]);
    const updates = periods.length === 0 ? [] : await this.prisma.indicatorUpdate.findMany({
      where: { tenantId: tenant, reportingPeriodId: { in: periods.map((p) => p.id) }, periodAchievement: { not: "" } },
      select: { indicatorId: true, reportingPeriodId: true },
    });
    const dueDays = new Map(profiles.map((p) => [p.projectId, p.indicatorEntryDueDays]));
    const recorded = new Set(updates.map((u) => recordedKey(u.indicatorId, u.reportingPeriodId)));
    return ok(projects.map((p): CollectionFacts => ({
      projectId: p.id, projectTitle: p.title, projectStart: toDay(p.startDate),
      ...(p.meOfficerId ? { meOfficerId: p.meOfficerId } : {}), ...(p.projectManagerId ? { projectManagerId: p.projectManagerId } : {}),
      dueDays: dueDays.get(p.id) ?? DEFAULT_ENTRY_DUE_DAYS,
      indicators: indicators.filter((i) => i.projectId === p.id).map((i) => ({ id: i.id, code: i.code, name: i.name, frequency: i.frequency, responsibleUserId: i.responsibleUserId })),
      periods: periods.filter((x) => x.projectId === p.id).map((x) => ({ id: x.id, start: toDay(x.startDate), end: toDay(x.endDate), isFinal: x.reportType === "FINAL" })),
      recorded,
    })));
  }
}

/** One risk snapshot per project per day (the id is `projectId:day`), kept as history behind the health label. */
export class PrismaRiskTrendStore implements IRiskTrendStore {
  constructor(private readonly prisma: PrismaClient) {}

  async save(t: ProjectRiskTrend) {
    const data = {
      riskScore: t.riskScore, riskLevel: t.riskLevel, contributingFactorsJson: JSON.stringify(t.contributingFactors),
      missingEvidenceCount: t.missingEvidenceCount, deadlineSlipsCount: t.deadlineSlipsCount, overdueChecklistItemsCount: t.overdueChecklistItemsCount, lastUpdated: t.lastUpdated,
    };
    await this.prisma.projectRiskTrend.upsert({
      where: { id: t.id },
      create: { id: t.id, tenantId: t.tenantIdValue, projectId: t.projectId, periodStart: t.periodStart, periodEnd: t.periodEnd, ...data },
      update: data,
    });
    return ok(undefined);
  }

  async history(projectId: string, tenantId: TenantId, limit: number) {
    const rows = await this.prisma.projectRiskTrend.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { periodStart: "desc" }, take: limit });
    return ok(rows.map((r) => ProjectRiskTrend.rehydrate({
      id: r.id, tenantId: r.tenantId, createdAt: r.createdAt,
      props: {
        projectId: r.projectId, periodStart: r.periodStart, periodEnd: r.periodEnd, riskScore: r.riskScore, riskLevel: r.riskLevel as ProjectRiskTrend["riskLevel"],
        contributingFactors: JSON.parse(r.contributingFactorsJson) as RiskFactor[], missingEvidenceCount: r.missingEvidenceCount, deadlineSlipsCount: r.deadlineSlipsCount,
        overdueChecklistItemsCount: r.overdueChecklistItemsCount, lastUpdated: r.lastUpdated,
      },
    })));
  }
}

/** The reporting profile's "days after a period ends that values are due" (5 when the project has no profile yet). */
export class PrismaEntryDueDays implements IEntryDueDays, IEntryDueDaysWriter {
  constructor(private readonly prisma: PrismaClient) {}

  async forProject(projectId: string, tenantId: TenantId): Promise<number> {
    const p = await this.prisma.reportingProfile.findFirst({ where: { projectId, tenantId: tenantId.toString() }, select: { indicatorEntryDueDays: true } });
    return p?.indicatorEntryDueDays ?? DEFAULT_ENTRY_DUE_DAYS;
  }

  /** Changes the profile's value; false when the project has no profile (so nothing was changed). */
  async set(projectId: string, days: number, tenantId: TenantId): Promise<boolean> {
    const res = await this.prisma.reportingProfile.updateMany({ where: { projectId, tenantId: tenantId.toString() }, data: { indicatorEntryDueDays: days } });
    return res.count > 0;
  }
}
