import type { PrismaClient } from "@prisma/client";
import { ok, type Assignment } from "@donordesk/domain";
import type { AssignmentQuery, IAssignmentSource } from "@donordesk/application";
import { stateFor, toDay, urgencyFor } from "./urgency.js";

const CLOSED = ["RESOLVED", "ACCEPTED_RISK", "NOT_APPLICABLE"];

/** Compliance items assigned to a person (the stored `assignedToId` that nothing used until now). */
export class ChecklistAssignmentSource implements IAssignmentSource {
  readonly kind = "CHECKLIST_ITEM" as const;
  constructor(private readonly prisma: PrismaClient) {}

  async list(q: AssignmentQuery) {
    const rows = await this.prisma.checklistItem.findMany({
      where: {
        tenantId: q.tenantId.toString(), status: { notIn: CLOSED }, assignedToId: q.assigneeId ?? { not: null },
        project: { archivedAt: null }, ...(q.projectId ? { projectId: q.projectId } : {}),
      },
      include: { project: { select: { title: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });
    return ok(rows.map((r): Assignment => {
      const due = r.dueDate ? toDay(r.dueDate) : undefined;
      return {
        key: `CHECKLIST_ITEM:${r.id}`, kind: "CHECKLIST_ITEM", projectId: r.projectId, projectTitle: r.project.title, title: r.title, assigneeId: r.assignedToId!,
        ...(due ? { dueDate: due } : {}), state: stateFor(due, q.today), urgent: r.severity === "CRITICAL" || r.severity === "HIGH",
        href: `/projects/${r.projectId}/compliance`, urgency: urgencyFor(due, q.today, 15),
      };
    }));
  }
}
