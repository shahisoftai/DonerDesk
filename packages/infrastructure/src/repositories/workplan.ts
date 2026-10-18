import type { PrismaClient } from "@prisma/client";
import { PlannedActivity, ok, type DeliveryFacts, type PlainDate, type PlanChangeSet, type PlanRevision, type PlanStatus, type RecurrenceRule, type Result, type TenantId, DomainError, toPlainDate } from "@donordesk/domain";
import type { IMyWeekReader, MyWeekSentBack, IMemberDirectory, IDeliveryFactsReader, IPlanContextReader, IPlannedActivityRepository, IPlanRevisionRepository } from "@donordesk/application";

/** Plan dates are stored as DATE: always a UTC midnight Date in, a "YYYY-MM-DD" out. */
const toDate = (d: PlainDate): Date => new Date(`${d}T00:00:00.000Z`);
const toDay = (d: Date): PlainDate => d.toISOString().slice(0, 10);

type Row = NonNullable<Awaited<ReturnType<PrismaClient["plannedActivity"]["findFirst"]>>>;

function data(item: PlannedActivity) {
  const s = item.snapshot();
  // null (not undefined) wherever a field can be cleared: Prisma ignores undefined on update.
  return {
    title: s.title,
    description: s.description,
    location: s.location ?? null,
    logframeActivityId: s.logframeActivityId ?? null,
    outputId: s.outputId ?? null,
    ownerUserId: s.ownerUserId ?? null,
    supportUserIds: JSON.stringify(s.supportUserIds),
    evidenceRequirementsJson: JSON.stringify(s.requiredFiles),
    plannedStart: toDate(s.plannedStart),
    plannedEnd: toDate(s.plannedEnd),
    targetParticipants: s.targetParticipants ?? null,
    targetCount: s.targetCount ?? null,
    status: s.status,
    statusReason: s.statusReason ?? null,
    completedAt: s.completedAt ?? null,
    cancelledAt: s.cancelledAt ?? null,
  };
}

function toDomain(row: Row): PlannedActivity {
  return PlannedActivity.rehydrate({
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    props: {
      title: row.title,
      description: row.description,
      ...(row.location ? { location: row.location } : {}),
      ...(row.logframeActivityId ? { logframeActivityId: row.logframeActivityId } : {}),
      ...(row.outputId ? { outputId: row.outputId } : {}),
      ...(row.ownerUserId ? { ownerUserId: row.ownerUserId } : {}),
      supportUserIds: JSON.parse(row.supportUserIds) as string[],
      requiredFiles: JSON.parse(row.evidenceRequirementsJson || "[]") as import("@donordesk/domain").EvidenceType[],
      plannedStart: toDay(row.plannedStart),
      plannedEnd: toDay(row.plannedEnd),
      originalStart: toDay(row.originalStart),
      originalEnd: toDay(row.originalEnd),
      ...(row.targetParticipants !== null ? { targetParticipants: row.targetParticipants } : {}),
      ...(row.targetCount !== null ? { targetCount: row.targetCount } : {}),
      status: row.status as PlanStatus,
      ...(row.statusReason ? { statusReason: row.statusReason } : {}),
      ...(row.seriesId ? { seriesId: row.seriesId } : {}),
      ...(row.recurrenceJson ? { recurrence: JSON.parse(row.recurrenceJson) as RecurrenceRule } : {}),
      ...(row.completedAt ? { completedAt: row.completedAt } : {}),
      ...(row.cancelledAt ? { cancelledAt: row.cancelledAt } : {}),
      createdById: row.createdById,
    },
  });
}

export class PrismaPlannedActivityRepository implements IPlannedActivityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private row(item: PlannedActivity) {
    const s = item.snapshot();
    return {
      id: item.id,
      tenantId: item.tenantIdValue,
      projectId: item.projectId,
      ...data(item),
      originalStart: toDate(s.originalStart),
      originalEnd: toDate(s.originalEnd),
      seriesId: s.seriesId ?? null,
      recurrenceJson: s.recurrence ? JSON.stringify(s.recurrence) : null,
      createdById: s.createdById,
    };
  }

  async create(item: PlannedActivity): Promise<Result<PlannedActivity, DomainError>> {
    await this.prisma.plannedActivity.create({ data: this.row(item) });
    return ok(item);
  }

  /** One statement, so a recurring series or a whole wizard plan is created all or not at all. */
  async createMany(items: PlannedActivity[]): Promise<Result<PlannedActivity[], DomainError>> {
    await this.prisma.plannedActivity.createMany({ data: items.map((i) => this.row(i)) });
    return ok(items);
  }

  async update(item: PlannedActivity): Promise<Result<PlannedActivity, DomainError>> {
    await this.prisma.plannedActivity.updateMany({ where: { id: item.id, tenantId: item.tenantIdValue }, data: data(item) });
    return ok(item);
  }

  async findById(id: string, tenantId: TenantId) {
    const row = await this.prisma.plannedActivity.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? toDomain(row) : null);
  }

  async findByProject(projectId: string, tenantId: TenantId) {
    const rows = await this.prisma.plannedActivity.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: [{ plannedStart: "asc" }, { plannedEnd: "asc" }, { title: "asc" }] });
    return ok(rows.map(toDomain));
  }

  async findBySeries(seriesId: string, tenantId: TenantId) {
    const rows = await this.prisma.plannedActivity.findMany({ where: { seriesId, tenantId: tenantId.toString() }, orderBy: { plannedStart: "asc" } });
    return ok(rows.map(toDomain));
  }
}

export class PrismaPlanRevisionRepository implements IPlanRevisionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(r: PlanRevision): Promise<Result<void, DomainError>> {
    await this.prisma.planRevision.create({
      data: { id: r.id, tenantId: r.tenantId, projectId: r.projectId, plannedActivityId: r.plannedActivityId, changeJson: JSON.stringify(r.change), reason: r.reason ?? null, changedById: r.changedById, changedAt: r.changedAt },
    });
    return ok(undefined);
  }

  private static toDomain(row: { id: string; tenantId: string; projectId: string; plannedActivityId: string; changeJson: string; reason: string | null; changedById: string; changedAt: Date }): PlanRevision {
    return { id: row.id, tenantId: row.tenantId, projectId: row.projectId, plannedActivityId: row.plannedActivityId, change: JSON.parse(row.changeJson) as PlanChangeSet, ...(row.reason ? { reason: row.reason } : {}), changedById: row.changedById, changedAt: row.changedAt };
  }

  async findByPlannedActivity(plannedActivityId: string, tenantId: TenantId) {
    const rows = await this.prisma.planRevision.findMany({ where: { plannedActivityId, tenantId: tenantId.toString() }, orderBy: { changedAt: "asc" } });
    return ok(rows.map(PrismaPlanRevisionRepository.toDomain));
  }

  async findRecentByProject(projectId: string, tenantId: TenantId, limit: number) {
    const rows = await this.prisma.planRevision.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { changedAt: "desc" }, take: limit });
    return ok(rows.map(PrismaPlanRevisionRepository.toDomain));
  }
}

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

/** Completed activities per planned activity, withdrawn ones left out (`isLiveActivity`). */
export class PrismaDeliveryFactsReader implements IDeliveryFactsReader {
  constructor(private readonly prisma: PrismaClient) {}

  async factsByPlannedActivity(projectId: string, tenantId: TenantId) {
    const rows = await this.prisma.activityUpdate.findMany({
      where: { projectId, tenantId: tenantId.toString(), plannedActivityId: { not: null }, status: { not: "WITHDRAWN" } },
      select: { id: true, plannedActivityId: true, status: true, activityDate: true, activityEndDate: true },
    });
    // The kinds of file attached to those completed activities, per planned activity.
    const files = rows.length === 0 ? [] : await this.prisma.evidenceFile.findMany({
      where: { tenantId: tenantId.toString(), activityId: { in: rows.map((r) => r.id) } },
      select: { activityId: true, evidenceType: true },
    });
    const plannedOf = new Map(rows.map((r) => [r.id, r.plannedActivityId!]));
    const typesByPlanned = new Map<string, Set<string>>();
    for (const f of files) {
      const planned = plannedOf.get(f.activityId ?? "");
      if (planned) typesByPlanned.set(planned, (typesByPlanned.get(planned) ?? new Set()).add(f.evidenceType));
    }
    const facts = new Map<string, DeliveryFacts>();
    for (const r of rows) {
      const id = r.plannedActivityId!;
      const f = facts.get(id) ?? { liveRecords: 0, acceptedRecords: 0, deliveredCount: 0 };
      const day = toDay(r.activityDate);
      const last = toDay(r.activityEndDate ?? r.activityDate);
      facts.set(id, {
        liveRecords: f.liveRecords + 1,
        acceptedRecords: f.acceptedRecords + (r.status === "ACCEPTED" ? 1 : 0),
        deliveredCount: f.deliveredCount + (r.status === "ACCEPTED" ? 1 : 0),
        firstRecordDate: f.firstRecordDate && f.firstRecordDate < day ? f.firstRecordDate : day,
        lastRecordDate: f.lastRecordDate && f.lastRecordDate > last ? f.lastRecordDate : last,
        evidenceTypes: [...(typesByPlanned.get(id) ?? [])],
      });
    }
    return ok(facts as ReadonlyMap<string, DeliveryFacts>);
  }
}

/** Active project members by lower-cased email. */
export class PrismaMemberDirectory implements IMemberDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  async activeUserIdsByEmail(projectId: string, tenantId: TenantId) {
    const members = await this.prisma.projectMember.findMany({ where: { projectId, tenantId: tenantId.toString(), status: "ACTIVE" }, select: { userId: true } });
    const users = await this.prisma.user.findMany({ where: { tenantId: tenantId.toString(), id: { in: members.map((m) => m.userId) } }, select: { id: true, email: true } });
    return ok(new Map(users.map((u) => [u.email.toLowerCase(), u.id])) as ReadonlyMap<string, string>);
  }
}

/** A person's own week across projects: open planned activities they lead or help with, and activities sent back to them. */
export class PrismaMyWeekReader implements IMyWeekReader {
  constructor(private readonly prisma: PrismaClient) {}

  async openPlannedFor(userId: string, tenantId: TenantId, startsOnOrBefore: PlainDate) {
    const rows = await this.prisma.plannedActivity.findMany({
      where: {
        tenantId: tenantId.toString(),
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        plannedStart: { lte: toDate(startsOnOrBefore) },
        OR: [{ ownerUserId: userId }, { supportUserIds: { contains: JSON.stringify(userId) } }],
        project: { showWorkPlanning: true, archivedAt: null },
      },
      include: { project: { select: { title: true } } },
      orderBy: [{ plannedStart: "asc" }, { title: "asc" }],
    });
    return ok(rows.map((r) => ({ item: toDomain(r), projectTitle: r.project.title })));
  }

  async sentBackFor(userId: string, tenantId: TenantId) {
    const rows = await this.prisma.activityUpdate.findMany({
      where: { tenantId: tenantId.toString(), submittedById: userId, status: { in: ["NEEDS_REVISION", "REJECTED"] }, project: { archivedAt: null } },
      select: { id: true, projectId: true, activityTitle: true, activityDate: true, status: true, project: { select: { title: true } } },
      orderBy: { activityDate: "desc" },
      take: 50,
    });
    return ok(rows.map((r): MyWeekSentBack => ({ id: r.id, projectId: r.projectId, projectTitle: r.project.title, title: r.activityTitle, activityDate: toDay(r.activityDate), status: r.status as MyWeekSentBack["status"] })));
  }
}
