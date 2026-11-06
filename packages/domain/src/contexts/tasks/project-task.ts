/**
 * A request: one person asking another for something in a project. Open until the thing arrives (closed by data, for the kinds
 * that can be seen in the records), the person marks it done, or the person who asked cancels it. Failures are Results.
 */
import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { isPlainDate, type PlainDate } from "../workplan/plain-date.js";
import { TASK_KINDS, type TaskKind, type TaskSubjectType } from "./task-kinds.js";

export type TaskStatus = "OPEN" | "DONE" | "CANCELLED";
export const TASK_STATUSES: TaskStatus[] = ["OPEN", "DONE", "CANCELLED"];

export interface ProjectTaskProps {
  kind: TaskKind;
  projectId: string;
  subjectType?: TaskSubjectType;
  subjectId?: string;
  /** The reporting period an indicator value is for. */
  reportingPeriodId?: string;
  title: string;
  details?: string;
  assigneeId: string;
  assignedById: string;
  dueDate: PlainDate;
  urgent: boolean;
  status: TaskStatus;
  completedById?: string;
  completedAt?: Date;
  completionNote?: string;
  /** True when the records showed it was met and nobody had to say so. */
  closedByData?: boolean;
}

export interface CreateProjectTaskInput {
  id: string;
  tenantId: string;
  kind: TaskKind;
  projectId: string;
  subjectType?: TaskSubjectType;
  subjectId?: string;
  reportingPeriodId?: string;
  title: string;
  details?: string;
  assigneeId: string;
  assignedById: string;
  dueDate: PlainDate;
  urgent?: boolean;
}

export class ProjectTask extends Entity<string> {
  private constructor(id: string, readonly tenantIdValue: string, private props: ProjectTaskProps, createdAt?: Date, updatedAt?: Date) {
    super(id, createdAt, updatedAt);
  }

  static create(input: CreateProjectTaskInput): Result<ProjectTask> {
    const spec = TASK_KINDS[input.kind];
    if (!input.title.trim()) return err(DomainError.validation("Say what you are asking for", { field: "title" }));
    if (!input.assigneeId) return err(DomainError.validation("Choose who you are asking", { field: "assigneeId" }));
    if (!isPlainDate(input.dueDate)) return err(DomainError.validation("Choose a date", { field: "dueDate" }));
    if (spec.subjects.length > 0 && (!input.subjectType || !input.subjectId)) return err(DomainError.validation("This request needs to be about something", { field: "subjectId" }));
    if (input.subjectType && !spec.subjects.includes(input.subjectType)) return err(DomainError.validation("This kind of request cannot be about that", { field: "subjectType" }));
    if (spec.subjects.length === 0 && (input.subjectType || input.subjectId)) return err(DomainError.validation("This request is not about anything in particular", { field: "subjectId" }));
    if (spec.needsPeriod && !input.reportingPeriodId) return err(DomainError.validation("Choose the reporting period the value is for", { field: "reportingPeriodId" }));
    return ok(
      new ProjectTask(input.id, input.tenantId, {
        kind: input.kind, projectId: input.projectId,
        ...(input.subjectType ? { subjectType: input.subjectType } : {}), ...(input.subjectId ? { subjectId: input.subjectId } : {}),
        ...(input.reportingPeriodId ? { reportingPeriodId: input.reportingPeriodId } : {}),
        title: input.title.trim(), ...(input.details?.trim() ? { details: input.details.trim() } : {}),
        assigneeId: input.assigneeId, assignedById: input.assignedById, dueDate: input.dueDate, urgent: input.urgent === true, status: "OPEN",
      }),
    );
  }

  static rehydrate(input: { id: string; tenantId: string; props: ProjectTaskProps; createdAt?: Date; updatedAt?: Date }): ProjectTask {
    return new ProjectTask(input.id, input.tenantId, { ...input.props }, input.createdAt, input.updatedAt);
  }

  get kind(): TaskKind { return this.props.kind; }
  get projectId(): string { return this.props.projectId; }
  get status(): TaskStatus { return this.props.status; }
  get isOpen(): boolean { return this.props.status === "OPEN"; }
  get assigneeId(): string { return this.props.assigneeId; }
  get assignedById(): string { return this.props.assignedById; }
  get dueDate(): PlainDate { return this.props.dueDate; }
  get subjectType(): TaskSubjectType | undefined { return this.props.subjectType; }
  get subjectId(): string | undefined { return this.props.subjectId; }
  get reportingPeriodId(): string | undefined { return this.props.reportingPeriodId; }
  get title(): string { return this.props.title; }

  snapshot(): Readonly<ProjectTaskProps> {
    return { ...this.props };
  }

  /** The person asked says it is done. Only a MANUAL kind closes this way; the others close when the thing arrives. */
  complete(by: string, at: Date, note?: string): Result<void> {
    if (!this.isOpen) return err(DomainError.invalidTransition("This request is already closed"));
    if (TASK_KINDS[this.props.kind].completion === "STATE") {
      return err(DomainError.invalidTransition("This request closes by itself when what you asked for is added"));
    }
    this.props.status = "DONE";
    this.props.completedById = by;
    this.props.completedAt = at;
    if (note?.trim()) this.props.completionNote = note.trim();
    this.touch();
    return ok(undefined);
  }

  /** The records show the request was met. Nobody had to say so. */
  closeByData(at: Date): Result<void> {
    if (!this.isOpen) return err(DomainError.invalidTransition("This request is already closed"));
    this.props.status = "DONE";
    this.props.completedAt = at;
    this.props.closedByData = true;
    this.touch();
    return ok(undefined);
  }

  /** Withdrawn by the person who asked (or an admin). */
  cancel(by: string, at: Date): Result<void> {
    if (!this.isOpen) return err(DomainError.invalidTransition("This request is already closed"));
    this.props.status = "CANCELLED";
    this.props.completedById = by;
    this.props.completedAt = at;
    this.touch();
    return ok(undefined);
  }
}
