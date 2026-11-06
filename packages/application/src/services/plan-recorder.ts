import { createPlanRevision, DomainError, ok, type PlanChange, type PlannedActivity, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../ports/core.js";
import type { IPlanRevisionRepository } from "../ports/workplan.js";

/** Stores the revision and the audit event for one plan change (every mutation is audited; reasons are the decision history). */
export class PlanRecorder {
  constructor(private readonly ids: IIdGenerator, private readonly revisions: IPlanRevisionRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async record(ctx: AuthenticatedContext, item: PlannedActivity, change: PlanChange, eventType: string): Promise<Result<void, DomainError>> {
    if (Object.keys(change.change).length > 0) {
      const revision = createPlanRevision({
        id: this.ids.generate(), tenantId: ctx.tenant.tenantId.toString(), projectId: item.projectId, plannedActivityId: item.id,
        change: change.change, ...(change.reason ? { reason: change.reason } : {}), changedById: ctx.tenant.userId, changedAt: this.clock.now(),
      });
      if (!revision.ok) return revision;
      const saved = await this.revisions.append(revision.value);
      if (!saved.ok) return saved;
    }
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType, entityType: "planned_activity", entityId: item.id, projectId: item.projectId,
      newValue: JSON.stringify(change.change), ...(change.reason ? { systemNote: change.reason } : {}),
    });
    return ok(undefined);
  }
}
