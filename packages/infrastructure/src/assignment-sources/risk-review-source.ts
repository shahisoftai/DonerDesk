import type { PrismaClient } from "@prisma/client";
import { ok, type Assignment } from "@donordesk/domain";
import type { AssignmentQuery, IAssignmentSource } from "@donordesk/application";
import { stateFor, toDay, urgencyFor } from "./urgency.js";

/**
 * Serious open problems that are due to be looked at again (every 30 days): the person handling it, else the project's manager.
 * Only open ones with a review date are work; the others are on the Overview card.
 */
export class RiskReviewAssignmentSource implements IAssignmentSource {
  readonly kind = "RISK_REVIEW" as const;
  constructor(private readonly prisma: PrismaClient) {}

  async list(q: AssignmentQuery) {
    const rows = await this.prisma.projectRisk.findMany({
      where: { tenantId: q.tenantId.toString(), status: "OPEN", reviewBy: { not: null }, project: { archivedAt: null }, ...(q.projectId ? { projectId: q.projectId } : {}) },
      include: { project: { select: { title: true, projectManagerId: true } } },
      orderBy: { reviewBy: "asc" },
    });
    const out: Assignment[] = [];
    for (const r of rows) {
      const owner = r.ownerId ?? r.project.projectManagerId;
      if (!owner || (q.assigneeId && owner !== q.assigneeId)) continue;
      const due = toDay(r.reviewBy!);
      out.push({
        key: `RISK_REVIEW:${r.id}`, kind: "RISK_REVIEW", projectId: r.projectId, projectTitle: r.project.title, title: `Review: ${r.title}`, assigneeId: owner,
        dueDate: due, state: stateFor(due, q.today), urgent: false, href: `/projects/${r.projectId}`, urgency: urgencyFor(due, q.today, 7),
      });
    }
    return ok(out);
  }
}
