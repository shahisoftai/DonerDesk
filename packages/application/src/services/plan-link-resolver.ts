import { DomainError, resolvePlanLink, err, ok, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IPlannedActivityRepository } from "../ports/workplan.js";

/** Validates a completed activity's link to a planned activity (the rule is the domain's `resolvePlanLink`). No link asked, no lookup. */
export class PlanLinkResolver {
  constructor(private readonly plans: IPlannedActivityRepository) {}

  async resolve(ctx: AuthenticatedContext, projectId: string, link: { plannedActivityId?: string | undefined; logframeActivityId?: string | undefined }): Promise<Result<{ plannedActivityId?: string; logframeActivityId?: string }, DomainError>> {
    if (!link.plannedActivityId) return ok(link.logframeActivityId ? { logframeActivityId: link.logframeActivityId } : {});
    const found = await this.plans.findById(link.plannedActivityId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const plan = found.value;
    const resolved = resolvePlanLink(plan ? { id: plan.id, projectId: plan.projectId, ...(plan.logframeActivityId ? { logframeActivityId: plan.logframeActivityId } : {}) } : undefined, {
      projectId, ...(link.logframeActivityId ? { logframeActivityId: link.logframeActivityId } : {}),
    });
    return resolved.ok ? ok(resolved.value) : err(DomainError.validation(resolved.message, { field: "plannedActivityId" }));
  }
}
