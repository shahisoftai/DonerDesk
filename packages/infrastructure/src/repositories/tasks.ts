import type { PrismaClient } from "@prisma/client";
import { Permissions, ProjectTask, ok, type DomainError, type PlainDate, type Result, type Role, type TaskKind, type TaskStatus, type TaskSubjectType, type TenantId } from "@donordesk/domain";
import type { IProjectRoster, IProjectTaskRepository, ITaskFactsReader, ITaskSubjectResolver, RosterMember, TaskSubjectInfo } from "@donordesk/application";

const toDate = (d: PlainDate): Date => new Date(`${d}T00:00:00.000Z`);
const toDay = (d: Date): PlainDate => d.toISOString().slice(0, 10);

type Row = NonNullable<Awaited<ReturnType<PrismaClient["projectTask"]["findFirst"]>>>;

function toDomain(row: Row): ProjectTask {
  return ProjectTask.rehydrate({
    id: row.id, tenantId: row.tenantId, createdAt: row.createdAt, updatedAt: row.updatedAt,
    props: {
      kind: row.kind as TaskKind, projectId: row.projectId,
      ...(row.subjectType ? { subjectType: row.subjectType as TaskSubjectType } : {}), ...(row.subjectId ? { subjectId: row.subjectId } : {}),
      ...(row.reportingPeriodId ? { reportingPeriodId: row.reportingPeriodId } : {}),
      title: row.title, ...(row.details ? { details: row.details } : {}),
      assigneeId: row.assigneeId, assignedById: row.assignedById, dueDate: toDay(row.dueDate), urgent: row.urgent, status: row.status as TaskStatus,
      ...(row.completedById ? { completedById: row.completedById } : {}), ...(row.completedAt ? { completedAt: row.completedAt } : {}),
      ...(row.completionNote ? { completionNote: row.completionNote } : {}), ...(row.closedByData ? { closedByData: true } : {}),
    },
  });
}

/** Mutable fields are written as null (not undefined) so a cleared value really clears. */
function mutable(t: ProjectTask) {
  const s = t.snapshot();
  return {
    title: s.title, details: s.details ?? null, assigneeId: s.assigneeId, dueDate: toDate(s.dueDate), urgent: s.urgent, status: s.status,
    completedById: s.completedById ?? null, completedAt: s.completedAt ?? null, completionNote: s.completionNote ?? null, closedByData: s.closedByData === true,
  };
}

export class PrismaProjectTaskRepository implements IProjectTaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(t: ProjectTask) {
    const s = t.snapshot();
    await this.prisma.projectTask.create({
      data: {
        id: t.id, tenantId: t.tenantIdValue, projectId: s.projectId, kind: s.kind,
        subjectType: s.subjectType ?? null, subjectId: s.subjectId ?? null, reportingPeriodId: s.reportingPeriodId ?? null,
        assignedById: s.assignedById, ...mutable(t),
      },
    });
    return ok(t);
  }

  async update(t: ProjectTask) {
    await this.prisma.projectTask.updateMany({ where: { id: t.id, tenantId: t.tenantIdValue }, data: mutable(t) });
    return ok(t);
  }

  async findById(id: string, tenantId: TenantId) {
    const row = await this.prisma.projectTask.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? toDomain(row) : null);
  }

  async findOpenByProject(projectId: string, tenantId: TenantId) {
    const rows = await this.prisma.projectTask.findMany({ where: { projectId, tenantId: tenantId.toString(), status: "OPEN" }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] });
    return ok(rows.map(toDomain));
  }

  async findOpenByAssignee(assigneeId: string, tenantId: TenantId) {
    const rows = await this.prisma.projectTask.findMany({ where: { assigneeId, tenantId: tenantId.toString(), status: "OPEN" }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] });
    return ok(rows.map(toDomain));
  }
}

/** What a request is about, read from the tables it points at. */
export class PrismaTaskSubjectResolver implements ITaskSubjectResolver {
  constructor(private readonly prisma: PrismaClient) {}

  async resolve(subjectType: TaskSubjectType, subjectId: string, tenantId: TenantId): Promise<Result<TaskSubjectInfo | null, DomainError>> {
    const tenant = tenantId.toString();
    if (subjectType === "plannedActivity") {
      const r = await this.prisma.plannedActivity.findFirst({ where: { id: subjectId, tenantId: tenant }, select: { projectId: true, title: true, plannedEnd: true } });
      return ok(r ? { projectId: r.projectId, title: r.title, end: toDay(r.plannedEnd) } : null);
    }
    if (subjectType === "activityUpdate") {
      const r = await this.prisma.activityUpdate.findFirst({ where: { id: subjectId, tenantId: tenant }, select: { projectId: true, activityTitle: true } });
      return ok(r ? { projectId: r.projectId, title: r.activityTitle } : null);
    }
    const r = await this.prisma.indicator.findFirst({ where: { id: subjectId, tenantId: tenant }, select: { projectId: true, code: true, name: true } });
    return ok(r ? { projectId: r.projectId, title: `${r.code} ${r.name}`.trim() } : null);
  }
}

/**
 * One checker per request kind that closes from data. A thing that was already there before the request does not meet it
 * (a file added since the request was made), except an indicator value, which is simply "the value exists".
 */
export class PrismaTaskFactsReader implements ITaskFactsReader {
  constructor(private readonly prisma: PrismaClient) {}

  private async met(task: ProjectTask, tenant: string): Promise<boolean> {
    const since = task.createdAt;
    const s = task.snapshot();
    switch (task.kind) {
      case "RECORD_ACTIVITY":
        return (await this.prisma.activityUpdate.count({ where: { tenantId: tenant, plannedActivityId: s.subjectId ?? "", status: { not: "WITHDRAWN" }, createdAt: { gte: since } } })) > 0;
      case "PROVIDE_EVIDENCE": {
        const base = { tenantId: tenant, createdAt: { gte: since } };
        if (s.subjectType === "plannedActivity") {
          const acts = await this.prisma.activityUpdate.findMany({ where: { tenantId: tenant, plannedActivityId: s.subjectId ?? "" }, select: { id: true } });
          return acts.length > 0 && (await this.prisma.evidenceFile.count({ where: { ...base, activityId: { in: acts.map((a) => a.id) } } })) > 0;
        }
        if (s.subjectType === "activityUpdate") return (await this.prisma.evidenceFile.count({ where: { ...base, activityId: s.subjectId ?? "" } })) > 0;
        return (await this.prisma.evidenceFile.count({ where: { ...base, indicatorId: s.subjectId ?? "", ...(s.reportingPeriodId ? { reportingPeriodId: s.reportingPeriodId } : {}) } })) > 0;
      }
      case "ENTER_INDICATOR_VALUE":
        return (await this.prisma.indicatorUpdate.count({ where: { tenantId: tenant, indicatorId: s.subjectId ?? "", reportingPeriodId: s.reportingPeriodId ?? "" } })) > 0;
      case "REVIEW_RECORD": {
        const a = await this.prisma.activityUpdate.findFirst({ where: { id: s.subjectId ?? "", tenantId: tenant }, select: { status: true } });
        return a !== null && a.status !== "SUBMITTED";
      }
      case "OTHER":
        return false;
    }
  }

  async satisfiedIds(tasks: ReadonlyArray<ProjectTask>, tenantId: TenantId) {
    const tenant = tenantId.toString();
    const met = new Set<string>();
    for (const t of tasks) if (await this.met(t, tenant)) met.add(t.id);
    return ok(met as ReadonlySet<string>);
  }
}

/** Active members of a project with their project role. */
export class PrismaProjectRoster implements IProjectRoster {
  constructor(private readonly prisma: PrismaClient) {}

  async activeMembers(projectId: string, tenantId: TenantId) {
    const rows = await this.prisma.projectMember.findMany({ where: { projectId, tenantId: tenantId.toString(), status: "ACTIVE" }, select: { userId: true, role: true } });
    return ok(rows.map((r): RosterMember => ({ userId: r.userId, role: r.role as Role })));
  }
}

/** Projects a person can act in for a permission: an admin everywhere, anyone else where their project role grants it. */
export async function projectsWithPermission(prisma: PrismaClient, tenantId: TenantId, userId: string, permission: Parameters<typeof Permissions.can>[1], projectId?: string): Promise<string[]> {
  const tenant = tenantId.toString();
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId: tenant }, select: { role: true } });
  if (!user) return [];
  const scope = projectId ? { id: projectId } : {};
  if (user.role === "ADMIN") {
    return (await prisma.project.findMany({ where: { tenantId: tenant, archivedAt: null, ...scope }, select: { id: true } })).map((p) => p.id);
  }
  const members = await prisma.projectMember.findMany({ where: { tenantId: tenant, userId, status: "ACTIVE", ...(projectId ? { projectId } : {}) }, select: { projectId: true, role: true } });
  const allowed = members.filter((m) => Permissions.can(m.role as Role, permission)).map((m) => m.projectId);
  if (allowed.length === 0) return [];
  return (await prisma.project.findMany({ where: { tenantId: tenant, id: { in: allowed }, archivedAt: null }, select: { id: true } })).map((p) => p.id);
}

