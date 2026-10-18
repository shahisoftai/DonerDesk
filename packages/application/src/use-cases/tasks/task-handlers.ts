import {
  DomainError, Permissions, ProjectTask, TASK_KINDS, formatShortDate, suggestTaskDueDate, toPlainDate, err, ok,
  type Result, type Role,
} from "@donordesk/domain";
import type { CompleteTaskInput, CreateTaskInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator, INotificationPort } from "../../ports/core.js";
import type { IProjectRoster, IProjectTaskRepository, ITaskSubjectResolver } from "../../ports/tasks.js";

const role = (ctx: AuthenticatedContext) => ctx.tenant.role as Role;

/**
 * One person asking another for something in a project. The kind comes from the button pressed; the person asked must be an
 * active member who is allowed to do what is asked (or the request could never be met). They are told in the app.
 */
export class CreateTaskHandler {
  constructor(
    private readonly ids: IIdGenerator, private readonly tasks: IProjectTaskRepository, private readonly subjects: ITaskSubjectResolver,
    private readonly roster: IProjectRoster, private readonly notify: INotificationPort, private readonly audit: IAuditLogger, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: CreateTaskInput): Promise<Result<{ id: string }, DomainError>> {
    if (!Permissions.can(role(ctx), "task.assign")) return err(DomainError.forbidden("You cannot make requests"));
    const spec = TASK_KINDS[input.kind];
    const tenantId = ctx.tenant.tenantId;
    const today = toPlainDate(this.clock.now())!;

    let subjectTitle: string | undefined;
    let subjectEnd: string | undefined;
    if (input.subjectType && input.subjectId) {
      const subject = await this.subjects.resolve(input.subjectType, input.subjectId, tenantId);
      if (!subject.ok) return subject;
      if (!subject.value || subject.value.projectId !== projectId) return err(DomainError.notFound("Subject", input.subjectId));
      subjectTitle = subject.value.title;
      subjectEnd = subject.value.end;
    }

    const members = await this.roster.activeMembers(projectId, tenantId);
    if (!members.ok) return members;
    const assignee = members.value.find((m) => m.userId === input.assigneeId);
    if (!assignee) return err(DomainError.validation("Only an active member of this project can be asked", { field: "assigneeId" }));
    if (!Permissions.can(assignee.role, spec.requires)) {
      return err(DomainError.validation("That person's role does not allow them to do this. Choose someone else.", { field: "assigneeId" }));
    }

    const dueDate = input.dueDate ?? suggestTaskDueDate(input.kind, { today, ...(subjectEnd ? { subjectEnd } : {}) });
    const created = ProjectTask.create({
      id: this.ids.generate(), tenantId: tenantId.toString(), kind: input.kind, projectId,
      ...(input.subjectType ? { subjectType: input.subjectType } : {}), ...(input.subjectId ? { subjectId: input.subjectId } : {}),
      ...(input.reportingPeriodId ? { reportingPeriodId: input.reportingPeriodId } : {}),
      title: input.kind === "OTHER" ? (input.title ?? "") : spec.title(subjectTitle),
      ...(input.note ? { details: input.note } : {}),
      assigneeId: input.assigneeId, assignedById: ctx.tenant.userId, dueDate, urgent: input.urgent,
    });
    if (!created.ok) return created;
    const saved = await this.tasks.create(created.value);
    if (!saved.ok) return saved;

    await this.notify.notify({
      tenantId, recipientId: input.assigneeId, type: "ASSIGNMENT", title: input.urgent ? "Urgent request" : "New request",
      message: `${created.value.title}. Due ${formatShortDate(dueDate, today)}.`, relatedEntityType: "project_task", relatedEntityId: created.value.id,
    });
    await this.audit.record({
      tenantId, actorId: ctx.tenant.userId, eventType: "task.created", entityType: "project_task", entityId: created.value.id, projectId,
      newValue: JSON.stringify({ kind: input.kind, assigneeId: input.assigneeId, dueDate, urgent: input.urgent }),
    });
    return ok({ id: created.value.id });
  }
}

/** The person asked (or the person who asked) marks a free-text request done. The other kinds close when what was asked for arrives. */
export class CompleteTaskHandler {
  constructor(private readonly tasks: IProjectTaskRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, taskId: string, input: CompleteTaskInput): Promise<Result<void, DomainError>> {
    const found = await this.tasks.findById(taskId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const task = found.value;
    if (!task) return err(DomainError.notFound("Request", taskId));
    if (task.assigneeId !== ctx.tenant.userId && task.assignedById !== ctx.tenant.userId) return err(DomainError.forbidden("This request is not yours"));
    const done = task.complete(ctx.tenant.userId, this.clock.now(), input.note);
    if (!done.ok) return done;
    const saved = await this.tasks.update(task);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "task.completed", entityType: "project_task", entityId: task.id, projectId: task.projectId });
    return ok(undefined);
  }
}

/** Withdrawn by the person who asked, or by an admin. */
export class CancelTaskHandler {
  constructor(private readonly tasks: IProjectTaskRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, taskId: string): Promise<Result<void, DomainError>> {
    const found = await this.tasks.findById(taskId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const task = found.value;
    if (!task) return err(DomainError.notFound("Request", taskId));
    if (task.assignedById !== ctx.tenant.userId && !Permissions.can(role(ctx), "org.manage")) return err(DomainError.forbidden("Only the person who asked can withdraw this request"));
    const cancelled = task.cancel(ctx.tenant.userId, this.clock.now());
    if (!cancelled.ok) return cancelled;
    const saved = await this.tasks.update(task);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "task.cancelled", entityType: "project_task", entityId: task.id, projectId: task.projectId });
    return ok(undefined);
  }
}
