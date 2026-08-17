import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type ReportDraftStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "EXPORTED" | "SUBMITTED";

export const REPORT_DRAFT_STATUSES: ReportDraftStatus[] = ["DRAFT", "UNDER_REVIEW", "APPROVED", "EXPORTED", "SUBMITTED"];

export interface ReportDraftProps {
  reportingPeriodId: string;
  title: string;
  status: ReportDraftStatus;
  version: number;
  generatedByAi: boolean;
  createdById: string;
  approvedById?: string;
  approvedAt?: Date;
}

export class ReportDraft extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: ReportDraftProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    reportingPeriodId: string;
    title: string;
    generatedByAi: boolean;
    createdById: string;
    version?: number;
  }): ReportDraft {
    if (!input.title) throw DomainError.validation("Report title required");
    return new ReportDraft(input.id, input.tenantId, input.projectId, {
      reportingPeriodId: input.reportingPeriodId,
      title: input.title,
      status: "DRAFT",
      version: input.version ?? 1,
      generatedByAi: input.generatedByAi,
      createdById: input.createdById,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    props: ReportDraftProps;
    createdAt: Date;
  }): ReportDraft {
    return new ReportDraft(input.id, input.tenantId, input.projectId, input.props, input.createdAt);
  }

  get reportingPeriodId(): string { return this.props.reportingPeriodId; }
  get title(): string { return this.props.title; }
  get status(): ReportDraftStatus { return this.props.status; }
  get version(): number { return this.props.version; }
  get generatedByAi(): boolean { return this.props.generatedByAi; }
  get createdById(): string { return this.props.createdById; }
  get approvedById(): string | undefined { return this.props.approvedById; }
  get approvedAt(): Date | undefined { return this.props.approvedAt; }

  /**
   * Corrects the AI-origin flag after generation. Set false when the provider
   * failed and the generator fell back to the stub, so the UI and billing
   * never present stub output as an AI-assisted draft.
   */
  setGeneratedByAi(value: boolean): void {
    if (this.props.generatedByAi === value) return;
    this.props.generatedByAi = value;
    this.touch();
  }

  rename(title: string): void {
    if (!title) throw DomainError.validation("Title required");
    if (this.props.status === "APPROVED" || this.props.status === "SUBMITTED") {
      throw DomainError.invalidTransition("Approved/submitted drafts cannot be renamed");
    }
    this.props.title = title;
    this.touch();
  }

  requestReview(): void {
    if (this.props.status !== "DRAFT") throw DomainError.invalidTransition("Only draft reports can be sent for review");
    this.props.status = "UNDER_REVIEW";
    this.touch();
  }

  /**
   * Rejects the report and returns it to DRAFT so block outcomes are
   * actionable. The rejection reason is recorded through the handler's audit
   * event; the draft itself only changes state (no schema change).
   */
  reject(): void {
    if (this.props.status !== "UNDER_REVIEW") throw DomainError.invalidTransition("Only reports under review can be rejected");
    this.props.status = "DRAFT";
    this.props.approvedById = undefined;
    this.props.approvedAt = undefined;
    this.touch();
  }

  approve(by: string): void {
    if (this.props.status !== "UNDER_REVIEW") throw DomainError.invalidTransition("Only reports under review can be approved");
    this.props.status = "APPROVED";
    this.props.approvedById = by;
    this.props.approvedAt = new Date();
    this.touch();
  }

  markExported(): void {
    if (this.props.status !== "APPROVED") throw DomainError.invalidTransition("Only approved reports can be exported");
    this.props.status = "EXPORTED";
    this.touch();
  }

  bumpVersion(): void {
    if (this.props.status === "SUBMITTED") throw DomainError.invalidTransition("Submitted reports cannot be versioned");
    this.props.version += 1;
    this.touch();
  }
}
