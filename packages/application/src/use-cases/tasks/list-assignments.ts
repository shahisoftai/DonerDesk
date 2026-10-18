import { DomainError, Permissions, err, groupByDue, ok, teamWorkSummary, toPlainDate, type Assignment, type DueGroup, type PlainDate, type Result, type Role, type TeamWorkRow } from "@donordesk/domain";
import type { ListAssignmentsQuery } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { AssignmentQueue } from "../../services/assignment-queue.js";
import type { TaskReconciler } from "../../services/task-reconciler.js";

export interface AssignmentsDto {
  today: PlainDate;
  userId: string;
  groups: DueGroup<Assignment>[];
  total: number;
}

/**
 * What a person is responsible for, grouped Late / Today / This week / Later / No date. Always their own unless they may see the
 * team's (`team.view-work`). Requests the records show were met are closed first, so the list is true when it is read.
 */
export class ListAssignmentsHandler {
  constructor(private readonly queue: AssignmentQueue, private readonly reconciler: TaskReconciler, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, query: ListAssignmentsQuery = {}): Promise<Result<AssignmentsDto, DomainError>> {
    const userId = query.userId ?? ctx.tenant.userId;
    if (userId !== ctx.tenant.userId && !Permissions.can(ctx.tenant.role as Role, "team.view-work")) {
      return err(DomainError.forbidden("You cannot see another person's work"));
    }
    // A failed clean-up must not hide the list.
    await this.reconciler.reconcile(ctx.tenant.tenantId, ctx.tenant.userId, { assigneeId: userId });
    const today = toPlainDate(this.clock.now())!;
    const list = await this.queue.list({ tenantId: ctx.tenant.tenantId, today, assigneeId: userId, ...(query.projectId ? { projectId: query.projectId } : {}) });
    if (!list.ok) return list;
    return ok({ today, userId, groups: groupByDue(list.value, today), total: list.value.length });
  }
}

export interface TeamWorkDto {
  today: PlainDate;
  rows: TeamWorkRow[];
}

/** People × counts for one project (late, due this week, open), for the people who manage the work. */
export class ListTeamWorkHandler {
  constructor(private readonly queue: AssignmentQueue, private readonly reconciler: TaskReconciler, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<TeamWorkDto, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "team.view-work")) return err(DomainError.forbidden("You cannot see the team's work"));
    await this.reconciler.reconcile(ctx.tenant.tenantId, ctx.tenant.userId, { projectId });
    const today = toPlainDate(this.clock.now())!;
    const list = await this.queue.list({ tenantId: ctx.tenant.tenantId, today, projectId });
    if (!list.ok) return list;
    return ok({ today, rows: teamWorkSummary(list.value, today) });
  }
}
