import type { PrismaClient } from "@prisma/client";
import { PlannedActivity, ok, type AutomationRuleKey, type DeliveryFacts, type PlainDate, type PlanChangeSet, type PlanRevision, type PlanStatus, type RecurrenceRule, type Result, type TenantId, DomainError, toPlainDate } from "@donordesk/domain";
import type { IMyWeekReader, MyWeekSentBack, IMemberDirectory, IDeliveryFactsReader, IPlanContextReader, IPlannedActivityRepository, IPlanRevisionRepository, IPlanDependencyRepository, PlanDependencyRecord, IProjectFieldRepository, ICustomFieldValueRepository, ProjectFieldRecord, IBudgetRepository, BudgetLineRecord, BudgetExpenseRecord, IMemberCapacityRepository, IAutomationSettings, IBeneficiaryRepository, BeneficiaryRecord, IPlannedActivityIndicatorRepository, IProgressRepository, ProgressEntryRecord } from "@donordesk/application";
import { enabledFrom } from "@donordesk/application";

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

/** Finish-to-start links between planned activities (phase 28.1-A). A duplicate pair is a conflict. */
export class PrismaPlanDependencyRepository implements IPlanDependencyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async add(link: PlanDependencyRecord): Promise<Result<void, DomainError>> {
    try {
      await this.prisma.plannedActivityDependency.create({
        data: { id: link.id, tenantId: link.tenantId, projectId: link.projectId, predecessorId: link.predecessorId, successorId: link.successorId, createdById: link.createdById, createdAt: link.createdAt },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { ok: false, error: DomainError.conflict("This link already exists") };
      throw e;
    }
    return ok(undefined);
  }

  async remove(predecessorId: string, successorId: string, tenantId: TenantId): Promise<Result<boolean, DomainError>> {
    const res = await this.prisma.plannedActivityDependency.deleteMany({ where: { tenantId: tenantId.toString(), predecessorId, successorId } });
    return ok(res.count > 0);
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<PlanDependencyRecord[], DomainError>> {
    const rows = await this.prisma.plannedActivityDependency.findMany({ where: { tenantId: tenantId.toString(), projectId }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => ({ id: r.id, tenantId: r.tenantId, projectId: r.projectId, predecessorId: r.predecessorId, successorId: r.successorId, createdById: r.createdById, createdAt: r.createdAt })));
  }
}

/** Custom fields a project defines (phase 28.1-C). A repeated key is a conflict. */
export class PrismaProjectFieldRepository implements IProjectFieldRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(f: ProjectFieldRecord): Promise<Result<void, DomainError>> {
    try {
      await this.prisma.projectField.create({
        data: { id: f.id, tenantId: f.tenantId, projectId: f.projectId, key: f.key, label: f.label, type: f.type, choicesJson: JSON.stringify(f.choices), createdById: f.createdById, createdAt: f.createdAt },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { ok: false, error: DomainError.conflict("A field with this name already exists") };
      throw e;
    }
    return ok(undefined);
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<ProjectFieldRecord[], DomainError>> {
    const rows = await this.prisma.projectField.findMany({ where: { tenantId: tenantId.toString(), projectId }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => ({ id: r.id, tenantId: r.tenantId, projectId: r.projectId, key: r.key, label: r.label, type: r.type, choices: JSON.parse(r.choicesJson) as string[], createdById: r.createdById, createdAt: r.createdAt })));
  }
}

/** Values on planned activities. A blank value removes the row, so blank stays blank. */
export class PrismaCustomFieldValueRepository implements ICustomFieldValueRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async setValues(
    entity: { tenantId: string; projectId: string; entityId: string; userId: string; now: Date },
    values: ReadonlyArray<{ fieldId: string; value: string | null }>,
  ): Promise<Result<void, DomainError>> {
    await this.prisma.$transaction(values.map((v) => (v.value === null
      ? this.prisma.customFieldValue.deleteMany({ where: { fieldId: v.fieldId, entityId: entity.entityId } })
      : this.prisma.customFieldValue.upsert({
        where: { fieldId_entityId: { fieldId: v.fieldId, entityId: entity.entityId } },
        create: { id: `${v.fieldId}:${entity.entityId}`, tenantId: entity.tenantId, projectId: entity.projectId, fieldId: v.fieldId, entityId: entity.entityId, value: v.value, updatedById: entity.userId, updatedAt: entity.now },
        update: { value: v.value, updatedById: entity.userId, updatedAt: entity.now },
      }))));
    return ok(undefined);
  }

  async findByEntity(entityId: string, tenantId: TenantId): Promise<Result<Record<string, string>, DomainError>> {
    const rows = await this.prisma.customFieldValue.findMany({ where: { tenantId: tenantId.toString(), entityId } });
    return ok(Object.fromEntries(rows.map((r) => [r.fieldId, r.value])));
  }
}

/** Budget lines and expenses on planned activities (phase 28.1-D). */
export class PrismaBudgetRepository implements IBudgetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async addLine(l: BudgetLineRecord): Promise<Result<void, DomainError>> {
    await this.prisma.budgetLine.create({
      data: { id: l.id, tenantId: l.tenantId, projectId: l.projectId, plannedActivityId: l.plannedActivityId, code: l.code, category: l.category, description: l.description, donorName: l.donorName, currency: l.currency, amountMinor: l.amountMinor, createdById: l.createdById, createdAt: l.createdAt },
    });
    return ok(undefined);
  }

  async countLines(plannedActivityId: string, tenantId: TenantId): Promise<Result<number, DomainError>> {
    return ok(await this.prisma.budgetLine.count({ where: { tenantId: tenantId.toString(), plannedActivityId } }));
  }

  async findLineById(id: string, tenantId: TenantId): Promise<Result<BudgetLineRecord | null, DomainError>> {
    const r = await this.prisma.budgetLine.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(r ? PrismaBudgetRepository.line(r) : null);
  }

  async findLinesByItem(plannedActivityId: string, tenantId: TenantId): Promise<Result<BudgetLineRecord[], DomainError>> {
    const rows = await this.prisma.budgetLine.findMany({ where: { tenantId: tenantId.toString(), plannedActivityId }, orderBy: { createdAt: "asc" } });
    return ok(rows.map(PrismaBudgetRepository.line));
  }

  async addExpense(e: BudgetExpenseRecord): Promise<Result<void, DomainError>> {
    await this.prisma.budgetExpense.create({
      data: { id: e.id, tenantId: e.tenantId, projectId: e.projectId, budgetLineId: e.budgetLineId, expenseDate: new Date(`${e.expenseDate}T00:00:00.000Z`), amountMinor: e.amountMinor, description: e.description, createdById: e.createdById, createdAt: e.createdAt },
    });
    return ok(undefined);
  }

  async findExpensesByLines(lineIds: string[], tenantId: TenantId): Promise<Result<BudgetExpenseRecord[], DomainError>> {
    if (lineIds.length === 0) return ok([]);
    const rows = await this.prisma.budgetExpense.findMany({ where: { tenantId: tenantId.toString(), budgetLineId: { in: lineIds } } });
    return ok(rows.map((r) => ({
      id: r.id, tenantId: r.tenantId, projectId: r.projectId, budgetLineId: r.budgetLineId, expenseDate: r.expenseDate.toISOString().slice(0, 10),
      amountMinor: r.amountMinor, description: r.description, createdById: r.createdById, createdAt: r.createdAt,
    })));
  }

  private static line(r: { id: string; tenantId: string; projectId: string; plannedActivityId: string; code: string; category: string; description: string; donorName: string; currency: string; amountMinor: number; createdById: string; createdAt: Date }): BudgetLineRecord {
    return { id: r.id, tenantId: r.tenantId, projectId: r.projectId, plannedActivityId: r.plannedActivityId, code: r.code, category: r.category, description: r.description, donorName: r.donorName, currency: r.currency, amountMinor: r.amountMinor, createdById: r.createdById, createdAt: r.createdAt };
  }
}

/** How many planned activities a person can lead in a week (phase 28.1-J). Blank is a null row value, never 0. */
export class PrismaMemberCapacityRepository implements IMemberCapacityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findMany(userIds: string[], tenantId: TenantId): Promise<Result<Map<string, number | null>, DomainError>> {
    const rows = userIds.length === 0 ? [] : await this.prisma.memberCapacity.findMany({ where: { tenantId: tenantId.toString(), userId: { in: userIds } } });
    return ok(new Map(rows.map((r) => [r.userId, r.activitiesPerWeek])));
  }

  async set(userId: string, value: number | null, by: { userId: string; now: Date }, tenantId: TenantId): Promise<Result<void, DomainError>> {
    const tenant = tenantId.toString();
    await this.prisma.memberCapacity.upsert({
      where: { tenantId_userId: { tenantId: tenant, userId } },
      create: { id: `${tenant}:${userId}`, tenantId: tenant, userId, activitiesPerWeek: value, updatedById: by.userId, updatedAt: by.now },
      update: { activitiesPerWeek: value, updatedById: by.userId, updatedAt: by.now },
    });
    return ok(undefined);
  }
}

/** Automation rules a project has switched off (phase 28.1-K). A rule with no row is on. */
export class PrismaAutomationSettings implements IAutomationSettings {
  constructor(private readonly prisma: PrismaClient) {}

  async stored(projectId: string, tenantId: TenantId): Promise<Result<Record<string, boolean>, DomainError>> {
    const rows = await this.prisma.projectAutomation.findMany({ where: { tenantId: tenantId.toString(), projectId } });
    return ok(Object.fromEntries(rows.map((r) => [r.ruleKey, r.enabled])));
  }

  async enabledRules(projectId: string, tenantId: TenantId): Promise<Result<Set<AutomationRuleKey>, DomainError>> {
    const stored = await this.stored(projectId, tenantId);
    if (!stored.ok) return stored;
    return ok(enabledFrom(stored.value));
  }

  async set(projectId: string, ruleKey: AutomationRuleKey, enabled: boolean, by: { userId: string; now: Date }, tenantId: TenantId): Promise<Result<void, DomainError>> {
    const tenant = tenantId.toString();
    await this.prisma.projectAutomation.upsert({
      where: { projectId_ruleKey: { projectId, ruleKey } },
      create: { id: `${projectId}:${ruleKey}`, tenantId: tenant, projectId, ruleKey, enabled, updatedById: by.userId, updatedAt: by.now },
      update: { enabled, updatedById: by.userId, updatedAt: by.now },
    });
    return ok(undefined);
  }
}

/** Beneficiary records by case code (phase 28.1-G). A repeated case code in a project is refused by the handler and the unique key. */
export class PrismaBeneficiaryRepository implements IBeneficiaryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async add(b: BeneficiaryRecord): Promise<Result<void, DomainError>> {
    try {
      await this.prisma.beneficiary.create({
        data: { id: b.id, tenantId: b.tenantId, projectId: b.projectId, caseCode: b.caseCode, sex: b.sex, ageGroup: b.ageGroup, location: b.location, enrolledOn: new Date(`${b.enrolledOn}T00:00:00.000Z`), consentRecordedById: b.consentRecordedById, createdById: b.createdById, createdAt: b.createdAt },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { ok: false, error: DomainError.conflict("This case code is already used in this project", { field: "caseCode" }) };
      throw e;
    }
    return ok(undefined);
  }

  async addMany(list: BeneficiaryRecord[]): Promise<Result<void, DomainError>> {
    try {
      await this.prisma.beneficiary.createMany({
        data: list.map((b) => ({ id: b.id, tenantId: b.tenantId, projectId: b.projectId, caseCode: b.caseCode, sex: b.sex, ageGroup: b.ageGroup, location: b.location, enrolledOn: new Date(`${b.enrolledOn}T00:00:00.000Z`), consentRecordedById: b.consentRecordedById, createdById: b.createdById, createdAt: b.createdAt })),
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { ok: false, error: DomainError.conflict("A case code in this file is already used in this project") };
      throw e;
    }
    return ok(undefined);
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<BeneficiaryRecord[], DomainError>> {
    const rows = await this.prisma.beneficiary.findMany({ where: { tenantId: tenantId.toString(), projectId }, orderBy: { caseCode: "asc" } });
    return ok(rows.map((r) => ({
      id: r.id, tenantId: r.tenantId, projectId: r.projectId, caseCode: r.caseCode, sex: r.sex, ageGroup: r.ageGroup, location: r.location,
      enrolledOn: r.enrolledOn.toISOString().slice(0, 10), consentRecordedById: r.consentRecordedById, createdById: r.createdById, createdAt: r.createdAt,
    })));
  }
}

/** Indicators a planned activity reports on. */
export class PrismaPlannedActivityIndicatorRepository implements IPlannedActivityIndicatorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findIndicatorIds(plannedActivityId: string, tenantId: TenantId): Promise<Result<string[], DomainError>> {
    const rows = await this.prisma.plannedActivityIndicator.findMany({ where: { tenantId: tenantId.toString(), plannedActivityId }, select: { indicatorId: true } });
    return ok(rows.map((r) => r.indicatorId));
  }

  async replace(input: { tenantId: string; projectId: string; plannedActivityId: string; indicatorIds: string[]; userId: string; now: Date }): Promise<Result<void, DomainError>> {
    await this.prisma.$transaction([
      this.prisma.plannedActivityIndicator.deleteMany({ where: { tenantId: input.tenantId, plannedActivityId: input.plannedActivityId } }),
      ...(input.indicatorIds.length
        ? [this.prisma.plannedActivityIndicator.createMany({
          data: input.indicatorIds.map((indicatorId) => ({ id: `${input.plannedActivityId}:${indicatorId}`, tenantId: input.tenantId, projectId: input.projectId, plannedActivityId: input.plannedActivityId, indicatorId, createdById: input.userId, createdAt: input.now })),
        })]
        : []),
    ]);
    return ok(undefined);
  }
}

type ProgressRow = NonNullable<Awaited<ReturnType<PrismaClient["progressEntry"]["findFirst"]>>>;

function toProgress(r: ProgressRow): ProgressEntryRecord {
  return {
    id: r.id, tenantId: r.tenantId, projectId: r.projectId, plannedActivityId: r.plannedActivityId, kind: r.kind as ProgressEntryRecord["kind"],
    from: r.fromDate.toISOString().slice(0, 10), to: r.toDate.toISOString().slice(0, 10),
    values: JSON.parse(r.valuesJson) as ProgressEntryRecord["values"], narrative: JSON.parse(r.narrativeJson) as ProgressEntryRecord["narrative"],
    absorbedById: r.absorbedById, createdById: r.createdById, updatedById: r.updatedById, createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

/** The progress log. Saving and removing change several rows, so each is one transaction. */
export class PrismaProgressRepository implements IProgressRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByItem(plannedActivityId: string, tenantId: TenantId): Promise<Result<ProgressEntryRecord[], DomainError>> {
    const rows = await this.prisma.progressEntry.findMany({ where: { tenantId: tenantId.toString(), plannedActivityId }, orderBy: [{ fromDate: "asc" }, { kind: "asc" }] });
    return ok(rows.map(toProgress));
  }

  async save(e: ProgressEntryRecord, absorbIds: string[]): Promise<Result<void, DomainError>> {
    const data = {
      kind: e.kind, fromDate: new Date(`${e.from}T00:00:00.000Z`), toDate: new Date(`${e.to}T00:00:00.000Z`),
      valuesJson: JSON.stringify(e.values), narrativeJson: JSON.stringify(e.narrative), absorbedById: e.absorbedById, updatedById: e.updatedById, updatedAt: e.updatedAt,
    };
    try {
      await this.prisma.$transaction([
        this.prisma.progressEntry.upsert({
          where: { id: e.id },
          create: { id: e.id, tenantId: e.tenantId, projectId: e.projectId, plannedActivityId: e.plannedActivityId, createdById: e.createdById, createdAt: e.createdAt, ...data },
          update: data,
        }),
        ...(absorbIds.length ? [this.prisma.progressEntry.updateMany({ where: { tenantId: e.tenantId, plannedActivityId: e.plannedActivityId, id: { in: absorbIds } }, data: { absorbedById: e.id } })] : []),
      ]);
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return { ok: false, error: DomainError.conflict("That day is already logged. Open that entry to change it.") };
      throw err;
    }
    return ok(undefined);
  }

  async remove(id: string, plannedActivityId: string, tenantId: TenantId): Promise<Result<boolean, DomainError>> {
    const tenant = tenantId.toString();
    const [, deleted] = await this.prisma.$transaction([
      this.prisma.progressEntry.updateMany({ where: { tenantId: tenant, plannedActivityId, absorbedById: id }, data: { absorbedById: null } }),
      this.prisma.progressEntry.deleteMany({ where: { id, tenantId: tenant, plannedActivityId } }),
    ]);
    return ok(deleted.count > 0);
  }
}
