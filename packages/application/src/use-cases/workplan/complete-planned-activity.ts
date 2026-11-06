import {
  DomainError, Permissions, canApplyPlanAction, err, isPlainDate, ok, parseCount, periodForDate, toPlainDate,
  type PlainDate, type Result, type Role,
} from "@donordesk/domain";
import type { CreateActivityUpdateInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import { PlanAccess } from "../../services/plan-access.js";
import type { ChangePlanStatusHandler } from "./plan-handlers.js";

/**
 * Marks a planned activity done in one step: the completed activity (what the reports use) and the plan status are saved together
 * from one short form. Everything that can refuse is checked first (the date, a reporting period for it, the status), so a refusal
 * changes nothing. The completed activity is created before the status, so a failure after it leaves an activity the person can
 * see and a plan item still open, never a done item with nothing behind it.
 */
export class CompletePlannedActivityHandler {
  constructor(
    private readonly access: PlanAccess,
    private readonly periods: IReportingPeriodRepository,
    private readonly activities: { handle(ctx: AuthenticatedContext, input: CreateActivityUpdateInput): Promise<Result<{ id: string }, DomainError>> },
    private readonly status: ChangePlanStatusHandler,
    private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: { finishedOn: string; people?: string; note?: string }): Promise<Result<{ activityId: string }, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "activity.create")) return err(DomainError.forbidden("You cannot record a completed activity"));
    const item = await this.access.load(ctx, itemId, "CHANGE_STATUS");
    if (!item.ok) return item;
    const plan = item.value.snapshot();

    if (!isPlainDate(input.finishedOn)) return err(DomainError.validation("Choose the day it finished", { field: "finishedOn" }));
    const today: PlainDate = toPlainDate(this.clock.now())!;
    if (input.finishedOn > today) return err(DomainError.validation("It cannot have finished in the future", { field: "finishedOn" }));
    const people = parseCount(input.people);
    if (!people.ok) return err(DomainError.validation("People reached must be a whole number, or left blank", { field: "people" }));
    if (!canApplyPlanAction(plan.status, "COMPLETE")) return err(DomainError.invalidTransition("This activity cannot be marked done from its current status"));

    const periods = await this.periods.findByProject(item.value.projectId, ctx.tenant.tenantId);
    if (!periods.ok) return periods;
    const periodId = periodForDate(periods.value.map((p) => ({ id: p.id, startDate: p.duration.start, endDate: p.duration.end })), input.finishedOn);
    if (!periodId) return err(DomainError.validation("No reporting period covers that day. Create the period first, then mark this done.", { field: "finishedOn" }));

    const created = await this.activities.handle(ctx, {
      projectId: item.value.projectId, reportingPeriodId: periodId, activityTitle: item.value.title,
      activityDate: `${input.finishedOn}T00:00:00.000Z`, plannedActivityId: itemId,
      ...(plan.location ? { location: plan.location } : {}),
      ...(people.value !== null ? { participantsTotal: people.value } : {}),
      summary: input.note?.trim() || `Completed: ${item.value.title}`,
      achievements: "", challenges: "", lessonsLearned: "", nextSteps: "", attachedEvidenceIds: [],
    });
    if (!created.ok) return created;

    const done = await this.status.handle(ctx, itemId, { action: "COMPLETE" });
    if (!done.ok) return done;
    return ok({ activityId: created.value.id });
  }
}
