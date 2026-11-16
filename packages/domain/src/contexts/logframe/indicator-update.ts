import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { isPlaceSplit, placeSplitEntries, projectWideEntries, type DisaggregationEntry } from "./indicator-disaggregation.js";

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
  /** The reviewer's reason for a correction or rejection. Kept apart from `comments` (the submitter's own note) so a save never overwrites it and it never reaches a report. */
  reviewNote?: string;
  dataSource?: string;
  /** Why this indicator does not apply to the period. When set the value is an answer in itself: no figure, never 0. */
  notApplicableReason?: string;
  attachedEvidenceIds: string[];
  /** Validated by `validateDisaggregation` before it reaches the aggregate. Holds the project-wide entries and (Phase 57) the splits inside places. */
  disaggregation?: DisaggregationEntry[];
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
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
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
    disaggregation?: DisaggregationEntry[];
    notApplicableReason?: string;
    createdById: string;
  }): IndicatorUpdate {
    return new IndicatorUpdate(input.id, input.tenantId, {
      indicatorId: input.indicatorId,
      reportingPeriodId: input.reportingPeriodId,
      periodAchievement: input.periodAchievement,
      cumulativeAchievement: input.cumulativeAchievement,
      comments: input.comments,
      dataSource: input.dataSource,
      notApplicableReason: input.notApplicableReason,
      attachedEvidenceIds: input.attachedEvidenceIds ?? [],
      disaggregation: input.disaggregation ? [...input.disaggregation] : [],
      verificationStatus: "DRAFT",
      createdById: input.createdById,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    props: IndicatorUpdateProps;
    createdAt: Date;
    /** The stored time of the last change; the version a concurrent save is checked against. */
    updatedAt?: Date;
  }): IndicatorUpdate {
    return new IndicatorUpdate(input.id, input.tenantId, input.props, input.createdAt, input.updatedAt);
  }

  get indicatorId(): string { return this.props.indicatorId; }
  get reportingPeriodId(): string { return this.props.reportingPeriodId; }
  get periodAchievement(): string { return this.props.periodAchievement; }
  get cumulativeAchievement(): string { return this.props.cumulativeAchievement; }
  get comments(): string | undefined { return this.props.comments; }
  get reviewNote(): string | undefined { return this.props.reviewNote; }
  get dataSource(): string | undefined { return this.props.dataSource; }
  get notApplicableReason(): string | undefined { return this.props.notApplicableReason; }
  get isNotApplicable(): boolean { return this.props.notApplicableReason !== undefined; }
  get attachedEvidenceIds(): string[] { return [...this.props.attachedEvidenceIds]; }
  /** The project-wide breakdown that reports, charts and exports read (splits inside places left out). */
  get disaggregation(): DisaggregationEntry[] { return projectWideEntries(this.props.disaggregation ?? []).map((e) => ({ ...e })); }
  /** The splits inside places (Phase 57): each adds up to its place's figure. */
  get placeSplits(): DisaggregationEntry[] { return placeSplitEntries(this.props.disaggregation ?? []).map((e) => ({ ...e })); }
  /** Everything stored: what the repository writes. */
  get breakdown(): DisaggregationEntry[] { return (this.props.disaggregation ?? []).map((e) => ({ ...e })); }
  get verificationStatus(): VerificationStatus { return this.props.verificationStatus; }
  get verifiedById(): string | undefined { return this.props.verifiedById; }
  get verifiedAt(): Date | undefined { return this.props.verifiedAt; }
  get createdById(): string { return this.props.createdById; }

  submit(): void {
    // Idempotent: an already-SUBMITTED row passes through unchanged so the
    // verify endpoint (`submit()` + `verify()`) works for updates that were
    // submitted earlier (e.g. via the period-values confirm flow). Without
    // this, SUBMITTED rows can never reach VERIFIED and assurance always fails.
    if (this.props.verificationStatus === "SUBMITTED") {
      return;
    }
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
    this.props.reviewNote = undefined;
    this.props.verifiedById = by;
    this.props.verifiedAt = new Date();
    this.touch();
  }

  requestCorrection(notes: string): void {
    const status = this.props.verificationStatus;
    if (status !== "SUBMITTED" && status !== "VERIFIED") {
      throw DomainError.invalidTransition(`Cannot request correction from status ${status}`);
    }
    const reason = notes.trim();
    if (!reason) throw DomainError.validation("A reason is required to request a correction");
    this.props.verificationStatus = "NEEDS_CORRECTION";
    this.props.reviewNote = reason;
    this.props.verifiedById = undefined;
    this.props.verifiedAt = undefined;
    this.touch();
  }

  reject(reason: string): void {
    if (this.props.verificationStatus !== "SUBMITTED") {
      throw DomainError.invalidTransition(`Cannot reject from status ${this.props.verificationStatus}`);
    }
    const trimmed = reason.trim();
    if (!trimmed) throw DomainError.validation("A reason is required to reject an update");
    this.props.verificationStatus = "REJECTED";
    this.props.reviewNote = trimmed;
    this.touch();
  }

  edit(patch: Partial<Pick<IndicatorUpdateProps, "periodAchievement" | "cumulativeAchievement" | "comments" | "dataSource" | "disaggregation" | "notApplicableReason">>): void {
    if (this.props.verificationStatus === "VERIFIED") {
      throw DomainError.invalidTransition("Verified updates cannot be edited");
    }
    // A breakdown sent without splits inside places keeps the stored splits of every place whose figure is unchanged.
    const next = patch.disaggregation && !patch.disaggregation.some(isPlaceSplit)
      ? { ...patch, disaggregation: [...patch.disaggregation, ...keptSplits(this.props.disaggregation ?? [], patch.disaggregation)] }
      : patch;
    this.props = { ...this.props, ...next };
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

/** The stored splits whose place still has the same figure in the new breakdown. */
function keptSplits(before: readonly DisaggregationEntry[], after: readonly DisaggregationEntry[]): DisaggregationEntry[] {
  const figure = (list: readonly DisaggregationEntry[]) => new Map(list.filter((e) => e.dimension === "LOCATION" && e.placeId).map((e) => [e.placeId!, e.value.trim()]));
  const old = figure(before);
  const now = figure(after);
  return placeSplitEntries(before).filter((e) => now.has(e.placeId!) && now.get(e.placeId!) === old.get(e.placeId!));
}
