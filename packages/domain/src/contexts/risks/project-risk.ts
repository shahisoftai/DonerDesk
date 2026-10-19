/**
 * "Problems and risks" (the RAID log, phase 28.1-E): a short list, not a register. Each entry is a problem that has happened, a
 * risk that might, an assumption we rely on, a decision taken, or a dependency on someone else. Each has what it is, how serious
 * (one choice: its impact), who is handling it and what is being done. No likelihood matrix. A serious one that stays open is
 * looked at again every 30 days (it appears in its owner's work). Never part of a donor report: the writer never receives it.
 */
import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { addDays, type PlainDate } from "../workplan/plain-date.js";

export type RiskKind = "PROBLEM" | "RISK" | "ASSUMPTION" | "DECISION" | "DEPENDENCY";
export type Seriousness = "HIGH" | "MEDIUM" | "LOW";
export type RiskStatus = "OPEN" | "CLOSED";

export const RISK_KINDS: RiskKind[] = ["PROBLEM", "RISK", "ASSUMPTION", "DECISION", "DEPENDENCY"];
export const SERIOUSNESS_LEVELS: Seriousness[] = ["HIGH", "MEDIUM", "LOW"];

/** What a person reads. "It has happened" / "It might happen", never PROBLEM / RISK. */
export const RISK_KIND_LABEL: Readonly<Record<RiskKind, string>> = {
  PROBLEM: "It has happened",
  RISK: "It might happen",
  ASSUMPTION: "We are assuming",
  DECISION: "We decided",
  DEPENDENCY: "We depend on someone",
};
/** The question asked for "what is being done", worded for each kind (phase 28.1-E). */
export const RISK_ACTION_HINT: Readonly<Record<RiskKind, string>> = {
  PROBLEM: "What is being done about it?",
  RISK: "What will be done if it happens?",
  ASSUMPTION: "How will we check it?",
  DECISION: "Why was this decided?",
  DEPENDENCY: "What do we need from them, and by when?",
};
export const SERIOUSNESS_LABEL: Readonly<Record<Seriousness, string>> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

/** A serious open problem is looked at again this many days after it was raised or last updated. */
export const REVIEW_EVERY_DAYS = 30;
export const MAX_TITLE = 200;
export const MAX_ACTION = 1000;

/** The review date a risk of this seriousness has: serious ones are reviewed, the others are not scheduled. */
export function reviewByFor(seriousness: Seriousness, today: PlainDate): PlainDate | undefined {
  return seriousness === "HIGH" ? addDays(today, REVIEW_EVERY_DAYS) : undefined;
}

export interface ProjectRiskProps {
  projectId: string;
  kind: RiskKind;
  title: string;
  seriousness: Seriousness;
  ownerId?: string;
  /** What is being done about it. */
  action: string;
  status: RiskStatus;
  closedNote?: string;
  closedById?: string;
  closedAt?: Date;
  /** The planned activity it affects, when raised from one. */
  plannedActivityId?: string;
  raisedById: string;
  reviewBy?: PlainDate;
}

export interface RiskFields {
  kind: RiskKind;
  title: string;
  seriousness: Seriousness;
  ownerId?: string | undefined;
  action: string;
}

function validate(f: Partial<RiskFields>): Result<void> {
  if (f.title !== undefined && (!f.title.trim() || f.title.trim().length > MAX_TITLE)) return err(DomainError.validation(`Say what it is, in ${MAX_TITLE} characters or fewer`, { field: "title" }));
  if (f.action !== undefined && f.action.trim().length > MAX_ACTION) return err(DomainError.validation(`What we are doing: ${MAX_ACTION} characters or fewer`, { field: "action" }));
  if (f.kind !== undefined && !RISK_KINDS.includes(f.kind)) return err(DomainError.validation("Choose whether it has happened or might happen", { field: "kind" }));
  if (f.seriousness !== undefined && !SERIOUSNESS_LEVELS.includes(f.seriousness)) return err(DomainError.validation("Choose how serious it is", { field: "seriousness" }));
  return ok(undefined);
}

export class ProjectRisk extends Entity<string> {
  private constructor(id: string, readonly tenantIdValue: string, private props: ProjectRiskProps, createdAt?: Date, updatedAt?: Date) {
    super(id, createdAt, updatedAt);
  }

  static create(input: RiskFields & { id: string; tenantId: string; projectId: string; raisedById: string; plannedActivityId?: string; today: PlainDate }): Result<ProjectRisk> {
    const valid = validate(input);
    if (!valid.ok) return valid;
    const reviewBy = reviewByFor(input.seriousness, input.today);
    return ok(new ProjectRisk(input.id, input.tenantId, {
      projectId: input.projectId, kind: input.kind, title: input.title.trim(), seriousness: input.seriousness,
      ...(input.ownerId ? { ownerId: input.ownerId } : {}), action: input.action.trim(), status: "OPEN",
      ...(input.plannedActivityId ? { plannedActivityId: input.plannedActivityId } : {}), raisedById: input.raisedById, ...(reviewBy ? { reviewBy } : {}),
    }));
  }

  static rehydrate(input: { id: string; tenantId: string; props: ProjectRiskProps; createdAt?: Date; updatedAt?: Date }): ProjectRisk {
    return new ProjectRisk(input.id, input.tenantId, { ...input.props }, input.createdAt, input.updatedAt);
  }

  get projectId(): string { return this.props.projectId; }
  get status(): RiskStatus { return this.props.status; }
  get isOpen(): boolean { return this.props.status === "OPEN"; }
  get ownerId(): string | undefined { return this.props.ownerId; }
  get raisedById(): string { return this.props.raisedById; }
  get title(): string { return this.props.title; }
  get seriousness(): Seriousness { return this.props.seriousness; }
  get reviewBy(): PlainDate | undefined { return this.props.reviewBy; }

  snapshot(): Readonly<ProjectRiskProps> {
    return { ...this.props };
  }

  /**
   * Changing what is being done, or who handles it, counts as looking at it again: a serious problem's review date moves out.
   * Becoming serious schedules a review; becoming less serious removes it.
   */
  update(patch: Partial<RiskFields>, today: PlainDate): Result<{ changed: string[] }> {
    if (!this.isOpen) return err(DomainError.invalidTransition("A closed problem cannot be changed"));
    const valid = validate(patch);
    if (!valid.ok) return valid;
    const changed: string[] = [];
    const set = <K extends keyof RiskFields>(key: K, value: RiskFields[K] | undefined) => {
      const next = typeof value === "string" ? value.trim() : value;
      if ((this.props as unknown as Record<string, unknown>)[key] === next || (next === undefined && !(key in this.props))) return;
      (this.props as unknown as Record<string, unknown>)[key] = next;
      if (next === undefined) delete (this.props as unknown as Record<string, unknown>)[key];
      changed.push(key);
    };
    if ("kind" in patch) set("kind", patch.kind);
    if ("title" in patch) set("title", patch.title);
    if ("seriousness" in patch) set("seriousness", patch.seriousness);
    if ("ownerId" in patch) set("ownerId", patch.ownerId || undefined);
    if ("action" in patch) set("action", patch.action);
    if (changed.length === 0) return ok({ changed });
    const review = reviewByFor(this.props.seriousness, today);
    if (review) this.props.reviewBy = review; else delete this.props.reviewBy;
    this.touch();
    return ok({ changed });
  }

  /** Closed by the person handling it, a manager, or whoever raised it. The note says how it ended. */
  close(by: string, note: string | undefined, at: Date): Result<void> {
    if (!this.isOpen) return err(DomainError.invalidTransition("This problem is already closed"));
    this.props.status = "CLOSED";
    this.props.closedById = by;
    this.props.closedAt = at;
    if (note?.trim()) this.props.closedNote = note.trim();
    delete this.props.reviewBy;
    this.touch();
    return ok(undefined);
  }
}

/** Who may change or close one: the person handling it, the one who raised it, and managers (`risk.manage`, passed in). */
export function canActOnRisk(actorId: string, risk: { ownerId?: string | undefined; raisedById: string }, isManager: boolean): boolean {
  return isManager || risk.ownerId === actorId || risk.raisedById === actorId;
}
