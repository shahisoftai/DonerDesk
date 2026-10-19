import { DomainError, Permissions, checkEntryDueDays, err, ok, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IEntryDueDays, IEntryDueDaysWriter } from "../../ports/health.js";

/** How many days after a period ends a project's indicator values are due. Anyone on the project may read it. */
export class GetEntryDueDaysHandler {
  constructor(private readonly dueDays: IEntryDueDays) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ days: number }, DomainError>> {
    return ok({ days: await this.dueDays.forProject(projectId, ctx.tenant.tenantId) });
  }
}

/** Sets that number. Needs permission to edit the project; audited; refused when the project has no reporting profile yet. */
export class SetEntryDueDaysHandler {
  constructor(private readonly writer: IEntryDueDaysWriter, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, projectId: string, days: unknown): Promise<Result<{ days: number }, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "project.edit")) return err(DomainError.forbidden("You cannot change when indicator values are due"));
    const valid = checkEntryDueDays(days);
    if (!valid.ok) return valid;
    const changed = await this.writer.set(projectId, valid.value, ctx.tenant.tenantId);
    if (!changed) return err(DomainError.validation("Set up the project's reporting profile first", { field: "days" }));
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "project.entry_due_days_set", entityType: "project", entityId: projectId, projectId,
      newValue: JSON.stringify({ days: valid.value }),
    });
    return ok({ days: valid.value });
  }
}
