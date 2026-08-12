import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type VerificationStatus = "DRAFT" | "SUBMITTED" | "VERIFIED" | "NEEDS_CORRECTION" | "REJECTED";

export const VERIFICATION_STATUSES: VerificationStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "VERIFIED",
  "NEEDS_CORRECTION",
  "REJECTED",
];

export interface IndicatorUpdateProps {
  indicatorId: string;
  reportingPeriodId: string;
  periodAchievement: string;
  cumulativeAchievement: string;
  comments?: string;
  dataSource?: string;
  attachedEvidenceIds: string[];
  verificationStatus: VerificationStatus;
  verifiedById?: string;
  verifiedAt?: Date;
  createdById: string;
}

export class IndicatorUpdate extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    private props: IndicatorUpdateProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    indicatorId: string;
    reportingPeriodId: string;
    periodAchievement: string;
    cumulativeAchievement: string;
    comments?: string;
    dataSource?: string;
    attachedEvidenceIds?: string[];
    createdById: string;
  }): IndicatorUpdate {
    return new IndicatorUpdate(input.id, input.tenantId, {
      indicatorId: input.indicatorId,
      reportingPeriodId: input.reportingPeriodId,
      periodAchievement: input.periodAchievement,
      cumulativeAchievement: input.cumulativeAchievement,
      comments: input.comments,
      dataSource: input.dataSource,
      attachedEvidenceIds: input.attachedEvidenceIds ?? [],
      verificationStatus: "DRAFT",
      createdById: input.createdById,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    props: IndicatorUpdateProps;
    createdAt: Date;
  }): IndicatorUpdate {
    return new IndicatorUpdate(input.id, input.tenantId, input.props, input.createdAt);
  }

  get indicatorId(): string { return this.props.indicatorId; }
  get reportingPeriodId(): string { return this.props.reportingPeriodId; }
  get periodAchievement(): string { return this.props.periodAchievement; }
  get cumulativeAchievement(): string { return this.props.cumulativeAchievement; }
  get comments(): string | undefined { return this.props.comments; }
  get dataSource(): string | undefined { return this.props.dataSource; }
  get attachedEvidenceIds(): string[] { return [...this.props.attachedEvidenceIds]; }
  get verificationStatus(): VerificationStatus { return this.props.verificationStatus; }
  get verifiedById(): string | undefined { return this.props.verifiedById; }
  get verifiedAt(): Date | undefined { return this.props.verifiedAt; }
  get createdById(): string { return this.props.createdById; }

  submit(): void {
    if (this.props.verificationStatus !== "DRAFT" && this.props.verificationStatus !== "NEEDS_CORRECTION") {
      throw DomainError.invalidTransition(`Cannot submit from status ${this.props.verificationStatus}`);
    }
    this.props.verificationStatus = "SUBMITTED";
    this.touch();
  }

  verify(by: string): void {
    if (this.props.verificationStatus !== "SUBMITTED") {
      throw DomainError.invalidTransition("Only submitted updates can be verified");
    }
    this.props.verificationStatus = "VERIFIED";
    this.props.verifiedById = by;
    this.props.verifiedAt = new Date();
    this.touch();
  }

  requestCorrection(notes: string): void {
    this.props.verificationStatus = "NEEDS_CORRECTION";
    if (notes) this.props.comments = notes;
    this.touch();
  }

  reject(reason: string): void {
    this.props.verificationStatus = "REJECTED";
    if (reason) this.props.comments = reason;
    this.touch();
  }

  edit(patch: Partial<Pick<IndicatorUpdateProps, "periodAchievement" | "cumulativeAchievement" | "comments" | "dataSource">>): void {
    if (this.props.verificationStatus === "VERIFIED") {
      throw DomainError.invalidTransition("Verified updates cannot be edited");
    }
    this.props = { ...this.props, ...patch };
    this.touch();
  }

  attachEvidence(evidenceId: string): void {
    if (!this.props.attachedEvidenceIds.includes(evidenceId)) {
      this.props.attachedEvidenceIds.push(evidenceId);
      this.touch();
    }
  }

  detachEvidence(evidenceId: string): void {
    this.props.attachedEvidenceIds = this.props.attachedEvidenceIds.filter((id) => id !== evidenceId);
    this.touch();
  }
}
