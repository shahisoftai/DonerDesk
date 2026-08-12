import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { DateRange } from "../../value-objects/date-range.js";
import { ReportStatus } from "../../value-objects/report-status.js";
import type { ReportType } from "../templates/donor-template.js";

export interface ReportingPeriodProps {
  donorTemplateId?: string;
  reportType: ReportType;
  duration: DateRange;
  deadline: Date;
  internalReviewDeadline?: Date;
  status: ReportStatus;
  readinessScore: number;
  responsibleOfficerId?: string;
}

export class ReportingPeriod extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: ReportingPeriodProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    donorTemplateId?: string;
    reportType: ReportType;
    startDate: Date;
    endDate: Date;
    deadline: Date;
    internalReviewDeadline?: Date;
    responsibleOfficerId?: string;
  }): ReportingPeriod {
    if (!input.deadline || isNaN(input.deadline.getTime())) throw DomainError.validation("Deadline required");
    return new ReportingPeriod(input.id, input.tenantId, input.projectId, {
      donorTemplateId: input.donorTemplateId,
      reportType: input.reportType,
      duration: DateRange.create(input.startDate, input.endDate),
      deadline: input.deadline,
      internalReviewDeadline: input.internalReviewDeadline,
      status: ReportStatus.NOT_STARTED(),
      readinessScore: 0,
      responsibleOfficerId: input.responsibleOfficerId,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    props: ReportingPeriodProps;
    createdAt: Date;
  }): ReportingPeriod {
    return new ReportingPeriod(input.id, input.tenantId, input.projectId, input.props, input.createdAt);
  }

  get donorTemplateId(): string | undefined { return this.props.donorTemplateId; }
  get reportType(): ReportType { return this.props.reportType; }
  get duration(): DateRange { return this.props.duration; }
  get deadline(): Date { return new Date(this.props.deadline.getTime()); }
  get internalReviewDeadline(): Date | undefined { return this.props.internalReviewDeadline ? new Date(this.props.internalReviewDeadline.getTime()) : undefined; }
  get status(): ReportStatus { return this.props.status; }
  get readinessScore(): number { return this.props.readinessScore; }
  get responsibleOfficerId(): string | undefined { return this.props.responsibleOfficerId; }

  daysUntilDeadline(): number {
    const ms = this.props.deadline.getTime() - Date.now();
    return Math.round(ms / (1000 * 60 * 60 * 24));
  }

  transitionTo(next: ReportStatus): void {
    if (!this.props.status.canTransitionTo(next)) {
      throw DomainError.invalidTransition(`Cannot transition from ${this.props.status} to ${next}`);
    }
    this.props.status = next;
    this.touch();
  }

  setReadinessScore(score: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    this.props.readinessScore = clamped;
    this.touch();
  }

  setDonorTemplate(id: string): void {
    this.props.donorTemplateId = id;
    this.touch();
  }
}
