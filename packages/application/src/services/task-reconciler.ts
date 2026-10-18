import { ok, TASK_KINDS, type DomainError, type Result } from "@donordesk/domain";
import type { TenantId } from "@donordesk/domain";
import type { IAuditLogger, IClock } from "../ports/core.js";
import type { AuthenticatedContext } from "../context.js";
import type { IProjectTaskRepository, ITaskFactsReader, ITaskReconciliation } from "../ports/tasks.js";

export type ReconcileScope = { assigneeId: string } | { projectId: string };

/**
 * Closes requests the records show were met ("Ask for a file" closes when the file is linked), like state checklist items.
 * Runs when someone reads their list and after the related change. Audited as `task.closed_by_data`. Reading never raises anything.
 */
export class TaskReconciler implements ITaskReconciliation {
  constructor(private readonly tasks: IProjectTaskRepository, private readonly facts: ITaskFactsReader, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async reconcile(tenantId: TenantId, actorId: string, scope: ReconcileScope): Promise<Result<number, DomainError>> {
    const open = "assigneeId" in scope ? await this.tasks.findOpenByAssignee(scope.assigneeId, tenantId) : await this.tasks.findOpenByProject(scope.projectId, tenantId);
    if (!open.ok) return open;
    const candidates = open.value.filter((t) => TASK_KINDS[t.kind].completion === "STATE");
    if (candidates.length === 0) return ok(0);
    const met = await this.facts.satisfiedIds(candidates, tenantId);
    if (!met.ok) return met;
    let closed = 0;
    for (const task of candidates.filter((t) => met.value.has(t.id))) {
      if (!task.closeByData(this.clock.now()).ok) continue;
      const saved = await this.tasks.update(task);
      if (!saved.ok) return saved;
      closed += 1;
      await this.audit.record({
        tenantId, actorId, eventType: "task.closed_by_data", entityType: "project_task", entityId: task.id, projectId: task.projectId,
        systemNote: `Closed because what was asked for is now in the records: ${task.title}`,
      });
    }
    return ok(closed);
  }

  /** Called after a change that may meet a request. A failure here is the reconciler's problem, never the change's. */
  async reconcileForCurrentUser(ctx: AuthenticatedContext): Promise<void> {
    try {
      await this.reconcile(ctx.tenant.tenantId, ctx.tenant.userId, { assigneeId: ctx.tenant.userId });
    } catch {
      /* the next read reconciles again */
    }
  }
}
