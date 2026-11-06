import type { PrismaClient } from "@prisma/client";
import { ok, TASK_KINDS, type Assignment, type TaskKind } from "@donordesk/domain";
import type { AssignmentQuery, IAssignmentSource } from "@donordesk/application";
import { stateFor, toDay, urgencyFor } from "./urgency.js";

const hrefFor = (projectId: string, subjectType: string | null, subjectId: string | null, periodId: string | null): string => {
  if (subjectType === "plannedActivity" && subjectId) return `/projects/${projectId}/activities/plan/${subjectId}`;
  if (subjectType === "activityUpdate" && subjectId) return `/projects/${projectId}/activities/${subjectId}`;
  if (subjectType === "indicator" && periodId) return `/projects/${projectId}/reports/${periodId}/inputs`;
  if (subjectType === "indicator") return `/projects/${projectId}/indicators`;
  return `/projects/${projectId}`;
};

/** Open requests made of a person (or of everyone in a project). */
export class TaskAssignmentSource implements IAssignmentSource {
  readonly kind = "TASK" as const;
  constructor(private readonly prisma: PrismaClient) {}

  async list(q: AssignmentQuery) {
    const rows = await this.prisma.projectTask.findMany({
      where: { tenantId: q.tenantId.toString(), status: "OPEN", ...(q.assigneeId ? { assigneeId: q.assigneeId } : {}), ...(q.projectId ? { projectId: q.projectId } : {}) },
      include: { project: { select: { title: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });
    return ok(rows.map((r): Assignment => {
      const due = toDay(r.dueDate);
      return {
        key: `TASK:${r.id}`, kind: "TASK", projectId: r.projectId, projectTitle: r.project.title, title: r.title, assigneeId: r.assigneeId, dueDate: due,
        state: stateFor(due, q.today), urgent: r.urgent, href: hrefFor(r.projectId, r.subjectType, r.subjectId, r.reportingPeriodId), urgency: urgencyFor(due, q.today, 5), askedById: r.assignedById, ...(TASK_KINDS[r.kind as TaskKind]?.completion === "MANUAL" ? { manual: true } : {}),
      };
    }));
  }
}

export type { TaskKind };
