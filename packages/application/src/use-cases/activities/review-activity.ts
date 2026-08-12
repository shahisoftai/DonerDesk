import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface ReviewActivityDecision {
  decision: "ACCEPT" | "REVISE" | "REJECT";
  notes?: string;
}

export class ReviewActivityHandler {
  constructor(private readonly repo: IActivityUpdateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, activityId: string, decision: ReviewActivityDecision): Promise<Result<void, DomainError>> {
    const r = await this.repo.findById(activityId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ActivityUpdate", activityId) };
    const a = r.value;
    if (decision.decision === "ACCEPT") a.accept();
    else if (decision.decision === "REVISE") a.requestRevision(decision.notes ?? "");
    else a.reject(decision.notes ?? "");
    const saved = await this.repo.update(a);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: `activity.${decision.decision.toLowerCase()}`,
      entityType: "activity_update",
      entityId: activityId,
      newValue: decision.notes,
    });
    return { ok: true, value: undefined };
  }
}
