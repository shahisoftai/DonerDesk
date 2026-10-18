import type { PrismaClient } from "@prisma/client";
import { NO_DELIVERY, ok, type Assignment, type DomainError, type Result, type TenantId } from "@donordesk/domain";
import { toWorkPlanRow, type AssignmentQuery, type IAssignmentSource, type IDeliveryFactsReader, type IPlannedActivityRepository } from "@donordesk/application";
import { PrismaDeliveryFactsReader, PrismaPlannedActivityRepository } from "../repositories/workplan.js";
import { stateFor, urgencyFor } from "./urgency.js";

/** Planned activities a person leads or helps with. Late means the same as everywhere else (`toWorkPlanRow`). */
export class PlanItemAssignmentSource implements IAssignmentSource {
  readonly kind = "PLAN_ITEM" as const;
  // Typed by their ports: a read can fail, and this source answers with the same error.
  private readonly plans: IPlannedActivityRepository;
  private readonly facts: IDeliveryFactsReader;
  constructor(private readonly prisma: PrismaClient) {
    this.plans = new PrismaPlannedActivityRepository(prisma);
    this.facts = new PrismaDeliveryFactsReader(prisma);
  }

  async list(q: AssignmentQuery): Promise<Result<Assignment[], DomainError>> {
    const tenant: TenantId = q.tenantId;
    const projects = await this.prisma.project.findMany({
      where: { tenantId: tenant.toString(), archivedAt: null, showWorkPlanning: true, ...(q.projectId ? { id: q.projectId } : {}) },
      select: { id: true, title: true },
    });
    const out: Assignment[] = [];
    for (const project of projects) {
      const items = await this.plans.findByProject(project.id, tenant);
      if (!items.ok) return { ok: false, error: items.error };
      const open = items.value.filter((i) => i.status === "PLANNED" || i.status === "IN_PROGRESS");
      if (open.length === 0) continue;
      const facts = await this.facts.factsByPlannedActivity(project.id, tenant);
      if (!facts.ok) return { ok: false, error: facts.error };
      for (const item of open) {
        const people = [...(item.ownerUserId ? [item.ownerUserId] : []), ...item.supportUserIds].filter((id) => !q.assigneeId || id === q.assigneeId);
        if (people.length === 0) continue;
        const row = toWorkPlanRow(item, facts.value.get(item.id) ?? NO_DELIVERY, q.today, false);
        for (const assigneeId of people) {
          out.push({
            key: `PLAN_ITEM:${item.id}:${assigneeId}`, kind: "PLAN_ITEM", projectId: project.id, projectTitle: project.title, title: item.title, assigneeId,
            dueDate: item.plannedEnd,
            // A late start is late even before the end date; a past end date is always late (the contract).
            state: row.signal === "LATE" ? "LATE" : stateFor(item.plannedEnd, q.today),
            urgent: false, href: `/projects/${project.id}/activities/plan/${item.id}`, urgency: urgencyFor(item.plannedEnd, q.today, 8),
          });
        }
      }
    }
    return ok(out);
  }
}
