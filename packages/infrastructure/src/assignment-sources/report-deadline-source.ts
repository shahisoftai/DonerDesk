import type { PrismaClient } from "@prisma/client";
import { addDays, ok, type Assignment } from "@donordesk/domain";
import type { AssignmentQuery, IAssignmentSource } from "@donordesk/application";
import { stateFor, toDay, urgencyFor } from "./urgency.js";

const FINISHED = ["APPROVED", "EXPORTED", "SENT", "SUBMITTED", "CLOSED"];
/** Deadlines further away than this are not work yet. */
const HORIZON_DAYS = 60;

const reportName = (reportType: string) => `${reportType.toLowerCase().replace(/_/g, " ")} report`;

/**
 * The deadlines of reports a person is responsible for: the period's responsible officer, else the project's reporting officer,
 * else its project manager. Both the donor deadline and the internal review deadline are listed.
 */
export class ReportDeadlineAssignmentSource implements IAssignmentSource {
  readonly kind = "REPORT_DEADLINE" as const;
  constructor(private readonly prisma: PrismaClient) {}

  async list(q: AssignmentQuery) {
    const horizon = new Date(`${addDays(q.today, HORIZON_DAYS)}T00:00:00.000Z`);
    const periods = await this.prisma.reportingPeriod.findMany({
      where: {
        tenantId: q.tenantId.toString(), cancelledAt: null, status: { notIn: FINISHED }, project: { archivedAt: null },
        deadline: { lte: horizon }, ...(q.projectId ? { projectId: q.projectId } : {}),
      },
      include: { project: { select: { title: true, reportingOfficerId: true, projectManagerId: true } } },
      orderBy: { deadline: "asc" },
    });
    const out: Assignment[] = [];
    for (const p of periods) {
      const owner = p.responsibleOfficerId ?? p.project.reportingOfficerId ?? p.project.projectManagerId;
      if (!owner || (q.assigneeId && owner !== q.assigneeId)) continue;
      const base = { kind: "REPORT_DEADLINE" as const, projectId: p.projectId, projectTitle: p.project.title, assigneeId: owner, urgent: false, href: `/projects/${p.projectId}/reports/${p.id}` };
      const due = toDay(p.deadline);
      out.push({ ...base, key: `REPORT_DEADLINE:${p.id}:donor`, title: `${reportName(p.reportType)} is due`, dueDate: due, state: stateFor(due, q.today), urgency: urgencyFor(due, q.today, 30) });
      if (p.internalReviewDeadline) {
        const review = toDay(p.internalReviewDeadline);
        out.push({ ...base, key: `REPORT_DEADLINE:${p.id}:review`, title: `${reportName(p.reportType)}: internal review`, dueDate: review, state: stateFor(review, q.today), urgency: urgencyFor(review, q.today, 30) });
      }
    }
    return ok(out);
  }
}
