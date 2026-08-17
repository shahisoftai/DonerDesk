import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import type { ChartConfig } from "./chart-config.js";

export type SectionStatus = "NOT_STARTED" | "DRAFTED" | "NEEDS_EVIDENCE" | "NEEDS_REVIEW" | "APPROVED";

export const SECTION_STATUSES: SectionStatus[] = ["NOT_STARTED", "DRAFTED", "NEEDS_EVIDENCE", "NEEDS_REVIEW", "APPROVED"];

export interface SourceReference {
  type: "evidence" | "activity" | "indicator" | "template";
  id: string;
  label?: string;
  /** Claim-level provenance links, populated by the structured generator. */
  claimId?: string;
  chunkId?: string;
}

export interface ReportSectionProps {
  sectionTitle: string;
  sectionOrder: number;
  content: string;
  sourceReferences: SourceReference[];
  unsupportedClaims: string[];
  status: SectionStatus;
  chartConfig?: ChartConfig | null;
}

export class ReportSection extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly reportDraftId: string,
    private props: ReportSectionProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    reportDraftId: string;
    sectionTitle: string;
    sectionOrder: number;
    content?: string;
    sourceReferences?: SourceReference[];
    unsupportedClaims?: string[];
    status?: SectionStatus;
    chartConfig?: ChartConfig | null;
  }): ReportSection {
    if (!input.sectionTitle) throw DomainError.validation("Section title required");
    return new ReportSection(input.id, input.tenantId, input.reportDraftId, {
      sectionTitle: input.sectionTitle,
      sectionOrder: input.sectionOrder,
      content: input.content ?? "",
      sourceReferences: input.sourceReferences ?? [],
      unsupportedClaims: input.unsupportedClaims ?? [],
      status: input.status ?? "NOT_STARTED",
      chartConfig: input.chartConfig ?? null,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    reportDraftId: string;
    props: ReportSectionProps;
    createdAt: Date;
  }): ReportSection {
    return new ReportSection(input.id, input.tenantId, input.reportDraftId, input.props, input.createdAt);
  }

  get sectionTitle(): string { return this.props.sectionTitle; }
  get sectionOrder(): number { return this.props.sectionOrder; }
  get content(): string { return this.props.content; }
  get sourceReferences(): SourceReference[] { return [...this.props.sourceReferences]; }
  get unsupportedClaims(): string[] { return [...this.props.unsupportedClaims]; }
  get status(): SectionStatus { return this.props.status; }
  get chartConfig(): ChartConfig | null { return this.props.chartConfig ?? null; }

  setContent(content: string, sourceRefs: SourceReference[], unsupported: string[]): void {
    this.props.content = content;
    this.props.sourceReferences = sourceRefs;
    this.props.unsupportedClaims = unsupported;
    if (this.props.status === "NOT_STARTED" || this.props.status === "NEEDS_EVIDENCE") {
      this.props.status = "DRAFTED";
    }
    this.touch();
  }

  setChartConfig(config: ChartConfig | null): void {
    this.props.chartConfig = config;
    this.touch();
  }

  markNeedsEvidence(): void {
    this.props.status = "NEEDS_EVIDENCE";
    this.touch();
  }

  markNeedsReview(): void {
    this.props.status = "NEEDS_REVIEW";
    this.touch();
  }

  approve(): void {
    if (this.props.status === "APPROVED") return;
    this.props.status = "APPROVED";
    this.touch();
  }

  resetToDraft(): void {
    this.props.status = "DRAFTED";
    this.touch();
  }
}
