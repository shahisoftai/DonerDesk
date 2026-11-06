import { DomainError, Permissions, err, ok, type Result, type Role } from "@donordesk/domain";
import type { SetOwnerInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IPersonNotifier } from "../../ports/reminders.js";
import type { IChecklistRepository } from "../../ports/compliance.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IProjectRoster } from "../../ports/tasks.js";

/** The lead must be an active member of the project (or nobody). One rule for the three pickers. */
async function checkLead(roster: IProjectRoster, ctx: AuthenticatedContext, projectId: string, userId: string | null): Promise<Result<void, DomainError>> {
  if (userId === null) return ok(undefined);
  const members = await roster.activeMembers(projectId, ctx.tenant.tenantId);
  if (!members.ok) return members;
  return members.value.some((m) => m.userId === userId) ? ok(undefined) : err(DomainError.validation("Only an active member of this project can lead this", { field: "userId" }));
}

const allowed = (ctx: AuthenticatedContext, permission: "logframe.manage" | "report.edit" | "checklist.manage") => Permissions.can(ctx.tenant.role as Role, permission);

/** Who is responsible for collecting an indicator's values. Wires the stored `responsibleUserId` to the screen. */
export class SetIndicatorOwnerHandler {
  constructor(private readonly indicators: IIndicatorRepository, private readonly roster: IProjectRoster, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, indicatorId: string, input: SetOwnerInput): Promise<Result<void, DomainError>> {
    if (!allowed(ctx, "logframe.manage")) return err(DomainError.forbidden("You cannot change who leads an indicator"));
    const found = await this.indicators.findById(indicatorId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return err(DomainError.notFound("Indicator", indicatorId));
    const indicator = found.value;
    const lead = await checkLead(this.roster, ctx, indicator.projectId, input.userId);
    if (!lead.ok) return lead;
    if ((indicator.responsibleUserId ?? null) === input.userId) return ok(undefined);
    const before = indicator.responsibleUserId ?? null;
    indicator.update({ responsibleUserId: input.userId ?? undefined });
    const saved = await this.indicators.update(indicator);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "indicator.owner_changed", entityType: "indicator", entityId: indicatorId, projectId: indicator.projectId, oldValue: String(before), newValue: String(input.userId) });
    return ok(undefined);
  }
}

/** Who is responsible for a report (its deadline then appears in their work). */
export class SetPeriodOwnerHandler {
  constructor(private readonly periods: IReportingPeriodRepository, private readonly roster: IProjectRoster, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, periodId: string, input: SetOwnerInput): Promise<Result<void, DomainError>> {
    if (!allowed(ctx, "report.edit")) return err(DomainError.forbidden("You cannot change who leads a report"));
    const found = await this.periods.findById(periodId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return err(DomainError.notFound("ReportingPeriod", periodId));
    const period = found.value;
    const lead = await checkLead(this.roster, ctx, period.projectId, input.userId);
    if (!lead.ok) return lead;
    if ((period.responsibleOfficerId ?? null) === input.userId) return ok(undefined);
    const before = period.responsibleOfficerId ?? null;
    period.assignResponsibleOfficer(input.userId ?? undefined);
    const saved = await this.periods.update(period);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "report.owner_changed", entityType: "reporting_period", entityId: periodId, projectId: period.projectId, oldValue: String(before), newValue: String(input.userId) });
    return ok(undefined);
  }
}

/** Who looks after a compliance item. Calls the aggregate's `assign()` that nothing used until now; the new lead is told. */
export class AssignChecklistItemHandler {
  constructor(private readonly checklist: IChecklistRepository, private readonly roster: IProjectRoster, private readonly notify: IPersonNotifier, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: SetOwnerInput): Promise<Result<void, DomainError>> {
    if (!allowed(ctx, "checklist.manage")) return err(DomainError.forbidden("You cannot assign compliance items"));
    const found = await this.checklist.findById(itemId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return err(DomainError.notFound("ChecklistItem", itemId));
    const item = found.value;
    const lead = await checkLead(this.roster, ctx, item.projectId, input.userId);
    if (!lead.ok) return lead;
    if ((item.assignedToId ?? null) === input.userId) return ok(undefined);
    const before = item.assignedToId ?? null;
    if (input.userId === null) item.unassign(); else item.assign(input.userId);
    const saved = await this.checklist.update(item);
    if (!saved.ok) return saved;
    if (input.userId !== null) {
      await this.notify.send({ tenantId: ctx.tenant.tenantId, recipientId: input.userId, type: "CHECKLIST_ASSIGNED", urgent: false, title: "Compliance item assigned to you", message: item.title, relatedEntityType: "checklist_item", relatedEntityId: itemId });
    }
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "checklist.assigned", entityType: "checklist_item", entityId: itemId, projectId: item.projectId, oldValue: String(before), newValue: String(input.userId) });
    return ok(undefined);
  }
}
