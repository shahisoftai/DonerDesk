import type { Assignment, AssignmentKind, PlainDate, ProjectTask, Result, Role, TaskSubjectType, TenantId } from "@donordesk/domain";

/** Persistence of the request aggregate. */
export interface IProjectTaskRepository {
  create(task: ProjectTask): Promise<Result<ProjectTask>>;
  update(task: ProjectTask): Promise<Result<ProjectTask>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ProjectTask | null>>;
  findOpenByProject(projectId: string, tenantId: TenantId): Promise<Result<ProjectTask[]>>;
  findOpenByAssignee(assigneeId: string, tenantId: TenantId): Promise<Result<ProjectTask[]>>;
}

export interface TaskSubjectInfo {
  projectId: string;
  /** What the person sees ("Outreach visits"). */
  title: string;
  /** For a planned activity: its end, so the suggested due date can follow it. */
  end?: PlainDate;
}

/** What a request is about: does it exist, which project is it in, what is it called. */
export interface ITaskSubjectResolver {
  resolve(subjectType: TaskSubjectType, subjectId: string, tenantId: TenantId): Promise<Result<TaskSubjectInfo | null>>;
}

/** Which open requests have been met according to the records (one checker per kind, in infrastructure). */
export interface ITaskFactsReader {
  satisfiedIds(tasks: ReadonlyArray<ProjectTask>, tenantId: TenantId): Promise<Result<ReadonlySet<string>>>;
}

export interface RosterMember {
  userId: string;
  role: Role;
}

/** The active members of a project with their project role (who can be asked, who can lead). */
export interface IProjectRoster {
  activeMembers(projectId: string, tenantId: TenantId): Promise<Result<RosterMember[]>>;
}

export interface AssignmentQuery {
  tenantId: TenantId;
  today: PlainDate;
  /** Only this person's. Absent = everyone's (the Team view); role-based sources then return nothing. */
  assigneeId?: string;
  projectId?: string;
}

/**
 * One source of things a person is responsible for. Every source returns the same `Assignment` shape with the same meaning of
 * `dueDate`, `state` and `href` (a shared contract test runs against each). Add a source = add a class and one row in the container.
 */
export interface IAssignmentSource {
  readonly kind: AssignmentKind;
  list(query: AssignmentQuery): Promise<Result<Assignment[]>>;
}

/**
 * Told by the handlers that add what a request asks for (a completed activity, a linked file, an indicator value, a review)
 * that something changed. Closes the acting person's own open requests that are now met. Never fails the caller.
 */
export interface ITaskReconciliation {
  reconcileForCurrentUser(ctx: import("../context.js").AuthenticatedContext): Promise<void>;
}
