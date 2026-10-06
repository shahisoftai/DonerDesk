import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IAuditLogger } from "../../ports/core.js";

/** Takes a record out of the reports: replaced by another record, or entered by mistake. */
export class WithdrawActivityHandler {
  constructor(private readonly repo: IActivityUpdateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: { activityId: string; supersededById?: string }): Promise<Result<{ id: string }, DomainError>> {
    const found = await this.repo.findById(input.activityId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const activity = found.value;
    if (!activity) return { ok: false, error: DomainError.notFound("ActivityUpdate", input.activityId) };

    if (input.supersededById) {
      if (input.supersededById === activity.id) return { ok: false, error: DomainError.validation("A record cannot replace itself.") };
      const replacement = await this.repo.findById(input.supersededById, ctx.tenant.tenantId);
      if (!replacement.ok) return replacement;
      if (!replacement.value || replacement.value.projectId !== activity.projectId) return { ok: false, error: DomainError.notFound("ActivityUpdate", input.supersededById) };
      if (replacement.value.status === "WITHDRAWN") return { ok: false, error: DomainError.validation("The replacing record is itself withdrawn.") };
    }

    try {
      activity.withdraw(input.supersededById);
    } catch (e) {
      if (e instanceof DomainError) return { ok: false, error: e };
      throw e;
    }
    const saved = await this.repo.update(activity);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "activity.withdrawn",
      entityType: "activity_update",
      entityId: activity.id,
      projectId: activity.projectId,
      newValue: input.supersededById ? `superseded by ${input.supersededById}` : undefined,
    });
    return { ok: true, value: { id: activity.id } };
  }
}

/** Brings a withdrawn record back; it goes through review again. */
export class RestoreActivityHandler {
  constructor(private readonly repo: IActivityUpdateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, activityId: string): Promise<Result<{ id: string }, DomainError>> {
    const found = await this.repo.findById(activityId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const activity = found.value;
    if (!activity) return { ok: false, error: DomainError.notFound("ActivityUpdate", activityId) };
    try {
      activity.restore();
    } catch (e) {
      if (e instanceof DomainError) return { ok: false, error: e };
      throw e;
    }
    const saved = await this.repo.update(activity);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "activity.restored",
      entityType: "activity_update",
      entityId: activity.id,
      projectId: activity.projectId,
    });
    return { ok: true, value: { id: activity.id } };
  }
}
