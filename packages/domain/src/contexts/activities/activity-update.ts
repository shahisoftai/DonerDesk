import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type ActivityStatus = "DRAFT" | "SUBMITTED" | "NEEDS_REVISION" | "ACCEPTED" | "REJECTED";

export const ACTIVITY_STATUSES: ActivityStatus[] = ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "ACCEPTED", "REJECTED"];

export interface ActivityUpdateProps {
  reportingPeriodId: string;
  activityTitle: string;
  activityDate: Date;
  location?: string;
  outputId?: string;
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
    location?: string;
    outputId?: string;
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
  get location(): string | undefined { return this.props.location; }
  get outputId(): string | undefined { return this.props.outputId; }
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

  submit(): void {
    if (this.props.status === "ACCEPTED") throw DomainError.invalidTransition("Cannot resubmit accepted activity");
    this.props.status = "SUBMITTED";
    this.touch();
  }

  accept(): void {
    if (this.props.status !== "SUBMITTED") throw DomainError.invalidTransition("Only submitted activities can be accepted");
    this.props.status = "ACCEPTED";
    this.touch();
  }

  requestRevision(notes: string): void {
    this.props.status = "NEEDS_REVISION";
    if (notes) this.props.summary = `${this.props.summary}\n\n[Reviewer note]: ${notes}`;
    this.touch();
  }

  reject(reason: string): void {
    this.props.status = "REJECTED";
    if (reason) this.props.summary = `${this.props.summary}\n\n[Rejected]: ${reason}`;
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
      >
    >,
  ): void {
    if (this.props.status === "ACCEPTED") throw DomainError.invalidTransition("Cannot edit accepted activity");
    this.props = { ...this.props, ...patch };
    this.touch();
  }
}
