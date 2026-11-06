import type { IPlannedActivityRepository } from "@donordesk/application";
import { DomainError, PlannedActivity, ok } from "@donordesk/domain";
import type { PlanStatus, RecurrenceRule, Result, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";
import { toDate, toDay } from "./plan-dates.js";

type Row = NonNullable<Awaited<ReturnType<PrismaClient["plannedActivity"]["findFirst"]>>>;

function data(item: PlannedActivity) {
  const s = item.snapshot();
  // null (not undefined) wherever a field can be cleared: Prisma ignores undefined on update.
  return {
    title: s.title,
    description: s.description,
    location: s.location ?? null,
    latitude: s.latitude ?? null,
    longitude: s.longitude ?? null,
    logframeActivityId: s.logframeActivityId ?? null,
    outputId: s.outputId ?? null,
    ownerUserId: s.ownerUserId ?? null,
    supportUserIds: JSON.stringify(s.supportUserIds),
    evidenceRequirementsJson: JSON.stringify(s.requiredFiles),
    plannedStart: toDate(s.plannedStart),
    plannedEnd: toDate(s.plannedEnd),
    targetParticipants: s.targetParticipants ?? null,
    targetCount: s.targetCount ?? null,
    effort: s.effort ?? 1,
    status: s.status,
    statusReason: s.statusReason ?? null,
    completedAt: s.completedAt ?? null,
    cancelledAt: s.cancelledAt ?? null,
  };
}

export function plannedActivityFromRow(row: Row): PlannedActivity {
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
      ...(row.latitude !== null && row.longitude !== null ? { latitude: row.latitude, longitude: row.longitude } : {}),
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
      ...(row.effort !== 1 ? { effort: row.effort } : {}),
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
    return ok(row ? plannedActivityFromRow(row) : null);
  }

  async findByProject(projectId: string, tenantId: TenantId) {
    const rows = await this.prisma.plannedActivity.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: [{ plannedStart: "asc" }, { plannedEnd: "asc" }, { title: "asc" }] });
    return ok(rows.map(plannedActivityFromRow));
  }

  async findBySeries(seriesId: string, tenantId: TenantId) {
    const rows = await this.prisma.plannedActivity.findMany({ where: { seriesId, tenantId: tenantId.toString() }, orderBy: { plannedStart: "asc" } });
    return ok(rows.map(plannedActivityFromRow));
  }
}
