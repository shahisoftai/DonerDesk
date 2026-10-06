import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { UpdateActivityInput } from "./update-activity.js";

/**
 * The submitter's answer to a revision request: optionally correct the record, then send it back to review.
 * Reviewer notes leave the text. The edit rules themselves stay in the aggregate; this only orders the two steps.
 */
export class ResubmitActivityHandler {
  constructor(private readonly repo: IActivityUpdateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: { activityId: string; patch?: NonNullable<UpdateActivityInput["patch"]> }): Promise<Result<{ id: string }, DomainError>> {
    const found = await this.repo.findById(input.activityId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const activity = found.value;
    if (!activity) return { ok: false, error: DomainError.notFound("ActivityUpdate", input.activityId) };
    try {
      if (input.patch && Object.keys(input.patch).length > 0) activity.edit(input.patch);
      activity.resubmit();
    } catch (e) {
      if (e instanceof DomainError) return { ok: false, error: e };
      throw e;
    }
    const saved = await this.repo.update(activity);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "activity.resubmitted",
      entityType: "activity_update",
      entityId: activity.id,
      projectId: activity.projectId,
    });
    return { ok: true, value: { id: activity.id } };
  }
}
