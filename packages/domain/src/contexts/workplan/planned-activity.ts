/**
 * A planned activity: work planned ahead, with dates, a lead and optional targets. Completed activities
 * (`ActivityUpdate`) link to it; its delivery state is derived (`delivery-state.ts`), never stored.
 *
 * Every change returns a `PlanChange` the handler stores as a `PlanRevision`; failures are `Result`s.
 * One date (start = end) makes it a milestone automatically, so no rule needs a special case for milestones.
 */
import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { compareDates, isPlainDate, toPlainDate, type PlainDate } from "./plain-date.js";
import { PLAN_STATUS_TRANSITIONS, canApplyPlanAction, type PlanAction, type PlanStatus } from "./plan-status-transitions.js";
import { reasonRequired } from "./reason-required.js";
import { diffFields, type PlanChange } from "./plan-revision.js";
import type { RecurrenceRule } from "./recurrence.js";
import type { PlanPeople } from "./assignment.js";
import { normalizeRequiredFiles } from "./required-files.js";
import type { EvidenceType } from "../evidence/evidence-file.js";

export type PlannedActivityKind = "ACTIVITY" | "MILESTONE";

/** Effort is a weight for the workload: 1 is a normal activity, 5 takes most of a person's week. */
export const MIN_EFFORT = 1;
export const MAX_EFFORT = 5;

export interface PlannedActivityDetails {
  title: string;
  description: string;
  location?: string;
  logframeActivityId?: string;
  outputId?: string;
  /** People expected; blank (never 0) when unknown. */
  targetParticipants?: number;
  /** Planned number of sessions or visits for an activity that spans several days. */
  targetCount?: number;
  /** How heavy the activity is for the person who leads it, 1 (light) to 5 (heavy). Unset means 1. The workload adds these up. */
  effort?: number;
}

export interface PlannedActivityProps extends PlannedActivityDetails {
  ownerUserId?: string;
  supportUserIds: string[];
  /** The kinds of file that should prove this activity ("Files we will need"). Never blocks anything. */
  requiredFiles: EvidenceType[];
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  /** The first dates saved; never changed afterwards ("moved from …"). */
  originalStart: PlainDate;
  originalEnd: PlainDate;
  status: PlanStatus;
  statusReason?: string;
  seriesId?: string;
  recurrence?: RecurrenceRule;
  completedAt?: Date;
  cancelledAt?: Date;
  createdById: string;
}

export interface CreatePlannedActivityInput extends Partial<PlannedActivityDetails> {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  people?: PlanPeople;
  requiredFiles?: ReadonlyArray<string>;
  seriesId?: string;
  recurrence?: RecurrenceRule;
  createdById: string;
}

/** What the application layer knows about the activity when a change may need a reason. */
export interface ChangeContext {
  today: PlainDate;
  reportUsesIt: boolean;
  reason?: string;
}

function validateDetails(d: Partial<PlannedActivityDetails>): Result<void> {
  if (d.title !== undefined && !d.title.trim()) return err(DomainError.validation("Give the activity a title"));
  if (d.effort !== undefined && (!Number.isInteger(d.effort) || d.effort < MIN_EFFORT || d.effort > MAX_EFFORT)) {
    return err(DomainError.validation(`Effort must be a whole number from ${MIN_EFFORT} to ${MAX_EFFORT}`, { field: "effort" }));
  }
  for (const [key, label] of [["targetParticipants", "People expected"], ["targetCount", "Number of sessions"]] as const) {
    const v = d[key];
    if (v !== undefined && (!Number.isInteger(v) || v < 1)) return err(DomainError.validation(`${label} must be a whole number of 1 or more, or left blank`));
  }
  return ok(undefined);
}

function validateDates(start: PlainDate, end: PlainDate): Result<void> {
  if (!isPlainDate(start)) return err(DomainError.validation("Choose a start date"));
  if (!isPlainDate(end)) return err(DomainError.validation("Choose an end date"));
  if (compareDates(end, start) < 0) return err(DomainError.validation("The end date must be on or after the start date"));
  return ok(undefined);
}

function needReason(ctx: ChangeContext, item: { originalEnd: PlainDate }): Result<string | undefined> {
  const reason = ctx.reason?.trim() || undefined;
  if (!reason && reasonRequired(item, ctx.today, ctx)) return err(DomainError.validation("Say why this activity is changing", { field: "reason" }));
  return ok(reason);
}

export class PlannedActivity extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: PlannedActivityProps,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  static create(input: CreatePlannedActivityInput): Result<PlannedActivity> {
    const details = validateDetails(input);
    if (!details.ok) return details;
    const dates = validateDates(input.plannedStart, input.plannedEnd);
    if (!dates.ok) return dates;
    const files = normalizeRequiredFiles(input.requiredFiles ?? []);
    if (!files.ok) return files;
    return ok(
      new PlannedActivity(input.id, input.tenantId, input.projectId, {
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        ...(input.location?.trim() ? { location: input.location.trim() } : {}),
        ...(input.logframeActivityId ? { logframeActivityId: input.logframeActivityId } : {}),
        ...(input.outputId ? { outputId: input.outputId } : {}),
        ...(input.targetParticipants !== undefined ? { targetParticipants: input.targetParticipants } : {}),
        ...(input.targetCount !== undefined ? { targetCount: input.targetCount } : {}),
        ...(input.effort !== undefined ? { effort: input.effort } : {}),
        ...(input.people?.ownerUserId ? { ownerUserId: input.people.ownerUserId } : {}),
        supportUserIds: [...(input.people?.supportUserIds ?? [])],
        requiredFiles: files.value,
        plannedStart: input.plannedStart,
        plannedEnd: input.plannedEnd,
        originalStart: input.plannedStart,
        originalEnd: input.plannedEnd,
        status: "PLANNED",
        ...(input.seriesId ? { seriesId: input.seriesId } : {}),
        ...(input.recurrence ? { recurrence: input.recurrence } : {}),
        createdById: input.createdById,
      }),
    );
  }

  static rehydrate(input: { id: string; tenantId: string; projectId: string; props: PlannedActivityProps; createdAt?: Date; updatedAt?: Date }): PlannedActivity {
    return new PlannedActivity(input.id, input.tenantId, input.projectId, { ...input.props, supportUserIds: [...input.props.supportUserIds], requiredFiles: [...(input.props.requiredFiles ?? [])] }, input.createdAt, input.updatedAt);
  }

  get kind(): PlannedActivityKind {
    return this.props.plannedStart === this.props.plannedEnd ? "MILESTONE" : "ACTIVITY";
  }
  get title(): string { return this.props.title; }
  get status(): PlanStatus { return this.props.status; }
  get plannedStart(): PlainDate { return this.props.plannedStart; }
  get plannedEnd(): PlainDate { return this.props.plannedEnd; }
  get originalStart(): PlainDate { return this.props.originalStart; }
  get originalEnd(): PlainDate { return this.props.originalEnd; }
  get ownerUserId(): string | undefined { return this.props.ownerUserId; }
  get supportUserIds(): ReadonlyArray<string> { return this.props.supportUserIds; }
  get logframeActivityId(): string | undefined { return this.props.logframeActivityId; }
  get seriesId(): string | undefined { return this.props.seriesId; }
  get requiredFiles(): ReadonlyArray<EvidenceType> { return this.props.requiredFiles; }
  get isMoved(): boolean {
    return this.props.plannedStart !== this.props.originalStart || this.props.plannedEnd !== this.props.originalEnd;
  }
  /** The calendar day it was marked done, for "done 4 days late". */
  get completedOn(): PlainDate | undefined {
    return this.props.completedAt ? toPlainDate(this.props.completedAt) : undefined;
  }

  snapshot(): Readonly<PlannedActivityProps> {
    return { ...this.props, supportUserIds: [...this.props.supportUserIds], requiredFiles: [...this.props.requiredFiles] };
  }

  applyStatus(action: PlanAction, ctx: { at: Date; reason?: string }): Result<PlanChange> {
    const rule = PLAN_STATUS_TRANSITIONS[action];
    if (!canApplyPlanAction(this.props.status, action)) return err(DomainError.invalidTransition(rule.refusal, { status: this.props.status, action }));
    const reason = ctx.reason?.trim() || undefined;
    if (rule.needsReason && !reason) return err(DomainError.validation("Say why this activity is cancelled", { field: "reason" }));
    const from = this.props.status;
    this.props.status = rule.to;
    this.props.statusReason = rule.needsReason ? reason : undefined;
    this.props.completedAt = rule.to === "DONE" ? ctx.at : undefined;
    this.props.cancelledAt = rule.to === "CANCELLED" ? ctx.at : undefined;
    this.touch();
    return ok({ change: { status: { from, to: rule.to } }, ...(reason ? { reason } : {}) });
  }

  reschedule(dates: { start: PlainDate; end: PlainDate }, ctx: ChangeContext): Result<PlanChange> {
    if (this.props.status === "DONE") return err(DomainError.invalidTransition("A done activity cannot be moved: reopen it first"));
    if (this.props.status === "CANCELLED") return err(DomainError.invalidTransition("A cancelled activity cannot be moved: restore it first"));
    const valid = validateDates(dates.start, dates.end);
    if (!valid.ok) return valid;
    const change = diffFields(this.props, { plannedStart: dates.start, plannedEnd: dates.end });
    if (Object.keys(change).length === 0) return err(DomainError.validation("These are already the activity's dates"));
    const reason = needReason(ctx, this.props);
    if (!reason.ok) return reason;
    this.props.plannedStart = dates.start;
    this.props.plannedEnd = dates.end;
    this.touch();
    return ok({ change, ...(reason.value ? { reason: reason.value } : {}) });
  }

  /** `people` has already passed `checkAssignable`. An empty change is a no-op, not an error. */
  assign(people: PlanPeople, ctx: { reason?: string } = {}): Result<PlanChange> {
    const change = diffFields(
      { ownerUserId: this.props.ownerUserId, supportUserIds: this.props.supportUserIds },
      { ownerUserId: people.ownerUserId, supportUserIds: [...people.supportUserIds] },
    );
    this.props.ownerUserId = people.ownerUserId;
    this.props.supportUserIds = [...people.supportUserIds];
    if (Object.keys(change).length) this.touch();
    const reason = ctx.reason?.trim();
    return ok({ change, ...(reason ? { reason } : {}) });
  }

  /** Which kinds of file should prove this activity. A no-op change returns an empty change set. */
  setRequiredFiles(types: ReadonlyArray<string>): Result<PlanChange> {
    if (this.props.status === "CANCELLED") return err(DomainError.invalidTransition("A cancelled activity cannot be edited: restore it first"));
    const files = normalizeRequiredFiles(types);
    if (!files.ok) return files;
    const change = diffFields({ requiredFiles: this.props.requiredFiles }, { requiredFiles: files.value });
    this.props.requiredFiles = files.value;
    if (Object.keys(change).length) this.touch();
    return ok({ change });
  }

  /** Title, notes, place, logframe link and targets. A changed target asks for a reason when `reasonRequired` says so. */
  updateDetails(patch: Partial<PlannedActivityDetails>, ctx: ChangeContext): Result<PlanChange> {
    if (this.props.status === "CANCELLED") return err(DomainError.invalidTransition("A cancelled activity cannot be edited: restore it first"));
    const valid = validateDetails(patch);
    if (!valid.ok) return valid;
    const next: Partial<PlannedActivityDetails> = { ...patch, ...(patch.title !== undefined ? { title: patch.title.trim() } : {}) };
    const change = diffFields<PlannedActivityDetails>(this.props, next);
    let reason: string | undefined = ctx.reason?.trim() || undefined;
    if ("targetCount" in change || "targetParticipants" in change) {
      const r = needReason(ctx, this.props);
      if (!r.ok) return r;
      reason = r.value;
    }
    for (const key of Object.keys(change) as Array<keyof PlannedActivityDetails>) {
      const value = next[key];
      if (value === undefined || value === "") {
        if (key === "title" || key === "description") (this.props as unknown as Record<string, unknown>)[key] = "";
        else delete this.props[key];
      } else (this.props as unknown as Record<string, unknown>)[key] = value;
    }
    if (Object.keys(change).length) this.touch();
    return ok({ change, ...(reason ? { reason } : {}) });
  }
}
