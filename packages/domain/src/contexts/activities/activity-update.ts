import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { ACTIVITY_TRANSITIONS, activityStatusAfter, canApplyActivityAction, splitReviewerNotes, type ActivityAction } from "./activity-transitions.js";

export type ActivityStatus = "DRAFT" | "SUBMITTED" | "NEEDS_REVISION" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export const ACTIVITY_STATUSES: ActivityStatus[] = ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "ACCEPTED", "REJECTED", "WITHDRAWN"];

export interface ActivityUpdateProps {
  reportingPeriodId: string;
  activityTitle: string;
  activityDate: Date;
  /** Last day of the span the record covers; absent when it happened on `activityDate` alone. */
  activityEndDate?: Date;
  location?: string;
  outputId?: string;
  /** The logframe ACTIVITY node this record delivers. */
  logframeActivityId?: string;
  indicatorId?: string;
  participantsTotal?: number;
  participantsMale?: number;
  participantsFemale?: number;
  participantsChildren?: number;
  participantsDisability?: number;
  participantsOther?: string;
  summary: string;
  achievements: string;
  challenges: string;
  lessonsLearned: string;
  nextSteps: string;
  attachedEvidenceIds: string[];
  status: ActivityStatus;
  submittedById: string;
  polishedNarrative?: string;
  /** The record that replaced this one when it was withdrawn. */
  supersededById?: string;
}

export class ActivityUpdate extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: ActivityUpdateProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    reportingPeriodId: string;
    activityTitle: string;
    activityDate: Date;
    activityEndDate?: Date;
    location?: string;
    outputId?: string;
    logframeActivityId?: string;
    indicatorId?: string;
    participantsTotal?: number;
    participantsMale?: number;
    participantsFemale?: number;
    participantsChildren?: number;
    participantsDisability?: number;
    participantsOther?: string;
    summary: string;
    achievements: string;
    challenges: string;
    lessonsLearned: string;
    nextSteps: string;
    attachedEvidenceIds?: string[];
    submittedById: string;
  }): ActivityUpdate {
    if (!input.activityTitle) throw DomainError.validation("Activity title required");
    if (!input.activityDate || isNaN(input.activityDate.getTime())) {
      throw DomainError.validation("Activity date required");
    }
    if (input.activityEndDate !== undefined) {
      if (isNaN(input.activityEndDate.getTime())) throw DomainError.validation("Activity end date is not a valid date");
      if (input.activityEndDate.getTime() < input.activityDate.getTime()) throw DomainError.validation("The end date cannot be before the activity date");
    }
    if (!input.summary) throw DomainError.validation("Summary required");
    return new ActivityUpdate(input.id, input.tenantId, input.projectId, {
      ...input,
      attachedEvidenceIds: input.attachedEvidenceIds ?? [],
      status: "DRAFT",
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    props: ActivityUpdateProps;
    createdAt: Date;
  }): ActivityUpdate {
    return new ActivityUpdate(input.id, input.tenantId, input.projectId, input.props, input.createdAt);
  }

  get reportingPeriodId(): string { return this.props.reportingPeriodId; }
  get activityTitle(): string { return this.props.activityTitle; }
  get activityDate(): Date { return new Date(this.props.activityDate.getTime()); }
  get activityEndDate(): Date | undefined { return this.props.activityEndDate ? new Date(this.props.activityEndDate.getTime()) : undefined; }
  get location(): string | undefined { return this.props.location; }
  get outputId(): string | undefined { return this.props.outputId; }
  get logframeActivityId(): string | undefined { return this.props.logframeActivityId; }
  get indicatorId(): string | undefined { return this.props.indicatorId; }
  get participantsTotal(): number | undefined { return this.props.participantsTotal; }
  get participantsMale(): number | undefined { return this.props.participantsMale; }
  get participantsFemale(): number | undefined { return this.props.participantsFemale; }
  get participantsChildren(): number | undefined { return this.props.participantsChildren; }
  get participantsDisability(): number | undefined { return this.props.participantsDisability; }
  get participantsOther(): string | undefined { return this.props.participantsOther; }
  get summary(): string { return this.props.summary; }
  get achievements(): string { return this.props.achievements; }
  get challenges(): string { return this.props.challenges; }
  get lessonsLearned(): string { return this.props.lessonsLearned; }
  get nextSteps(): string { return this.props.nextSteps; }
  get attachedEvidenceIds(): string[] { return [...this.props.attachedEvidenceIds]; }
  get status(): ActivityStatus { return this.props.status; }
  get submittedById(): string { return this.props.submittedById; }
  get polishedNarrative(): string | undefined { return this.props.polishedNarrative; }
  get supersededById(): string | undefined { return this.props.supersededById; }

  attachEvidence(id: string): void {
    if (!this.props.attachedEvidenceIds.includes(id)) {
      this.props.attachedEvidenceIds.push(id);
      this.touch();
    }
  }

  detachEvidence(id: string): void {
    this.props.attachedEvidenceIds = this.props.attachedEvidenceIds.filter((e) => e !== id);
    this.touch();
  }

  setPolishedNarrative(text: string): void {
    this.props.polishedNarrative = text;
    this.touch();
  }

  private apply(action: ActivityAction): void {
    if (!canApplyActivityAction(this.props.status, action)) {
      throw DomainError.invalidTransition(`${ACTIVITY_TRANSITIONS[action].refusal} (it is ${this.props.status.toLowerCase().replace(/_/g, " ")}).`);
    }
    this.props.status = activityStatusAfter(this.props.status, action);
  }

  submit(): void {
    this.apply("SUBMIT");
    this.touch();
  }

  /**
   * The submitter's answer to a revision request: the reviewer's notes leave the text (they are shown beside it
   * while editing and must never reach a report) and the record goes back to review.
   */
  resubmit(): void {
    if (this.props.status !== "NEEDS_REVISION") throw DomainError.invalidTransition("Only an activity sent back for revision can be resubmitted.");
    this.props.summary = splitReviewerNotes(this.props.summary).summary;
    this.apply("SUBMIT");
    this.touch();
  }

  accept(): void {
    this.apply("ACCEPT");
    this.touch();
  }

  requestRevision(notes: string): void {
    this.apply("REQUEST_REVISION");
    if (notes) this.props.summary = `${this.props.summary}\n\n[Reviewer note]: ${notes}`;
    this.touch();
  }

  reject(reason: string): void {
    this.apply("REJECT");
    if (reason) this.props.summary = `${this.props.summary}\n\n[Rejected]: ${reason}`;
    this.touch();
  }

  /** Takes the record out of the reports (a replacement exists, or it was entered by mistake). Reversible with `restore`. */
  withdraw(supersededById?: string): void {
    this.apply("WITHDRAW");
    this.props.supersededById = supersededById;
    this.touch();
  }

  /** Brings a withdrawn record back; it goes through review again. */
  restore(): void {
    this.apply("RESTORE");
    this.props.supersededById = undefined;
    this.touch();
  }

  edit(
    patch: Partial<
      Pick<
        ActivityUpdateProps,
        | "summary"
        | "achievements"
        | "challenges"
        | "lessonsLearned"
        | "nextSteps"
        | "location"
        | "participantsTotal"
        | "participantsMale"
        | "participantsFemale"
        | "participantsChildren"
        | "participantsDisability"
        | "participantsOther"
        | "indicatorId"
        | "outputId"
        | "logframeActivityId"
      >
    >,
  ): void {
    if (!canApplyActivityAction(this.props.status, "EDIT")) throw DomainError.invalidTransition(`Cannot edit ${this.props.status === "ACCEPTED" ? "an accepted" : "a withdrawn"} activity`);
    this.props = { ...this.props, ...patch };
    this.touch();
  }
}
