import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import type { ChartConfig } from "./chart-config.js";
import { isGenerationFallbackReason, type GenerationFallback } from "./generation-fallback.js";

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

/** Deepest sub-section level (1 = section, 2-4 = sub-sections), as in the donor template. */
export const MAX_REPORT_SECTION_LEVEL = 4;

export interface ReportSectionProps {
  sectionTitle: string;
  sectionOrder: number;
  /** Heading depth 1..MAX_REPORT_SECTION_LEVEL; the parent is the nearest earlier section one level up. */
  level: number;
  /** Donor numbering as printed in the template ("2.1"); `sectionTitle` already starts with it. */
  numbering?: string;
  /** The template section this was planned from; undefined for manually added sections. */
  templateSectionId?: string;
  content: string;
  sourceReferences: SourceReference[];
  unsupportedClaims: string[];
  status: SectionStatus;
  chartConfig?: ChartConfig | null;
  /** The revision whose content this section currently points at. */
  currentRevisionId?: string;
  /** Why the current text was not written by the AI; absent when it was, or when a person wrote it. */
  generationFallback?: GenerationFallback;
  /** When a person confirmed the summary still matches the report; later changes make it stale again. */
  summaryCurrentAt?: Date;
}

export class ReportSection extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly reportDraftId: string,
    private props: ReportSectionProps,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    reportDraftId: string;
    sectionTitle: string;
    sectionOrder: number;
    level?: number;
    numbering?: string;
    templateSectionId?: string;
    content?: string;
    sourceReferences?: SourceReference[];
    unsupportedClaims?: string[];
    status?: SectionStatus;
    chartConfig?: ChartConfig | null;
  }): ReportSection {
    if (!input.sectionTitle) throw DomainError.validation("Section title required");
    const level = input.level ?? 1;
    if (!Number.isInteger(level) || level < 1 || level > MAX_REPORT_SECTION_LEVEL) {
      throw DomainError.validation(`Section level must be between 1 and ${MAX_REPORT_SECTION_LEVEL}`);
    }
    return new ReportSection(input.id, input.tenantId, input.reportDraftId, {
      sectionTitle: input.sectionTitle,
      sectionOrder: input.sectionOrder,
      level,
      ...(input.numbering?.trim() ? { numbering: input.numbering.trim() } : {}),
      ...(input.templateSectionId ? { templateSectionId: input.templateSectionId } : {}),
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
    /** Stored last-modified time; the section's optimistic-concurrency version. */
    updatedAt?: Date;
  }): ReportSection {
    return new ReportSection(input.id, input.tenantId, input.reportDraftId, input.props, input.createdAt, input.updatedAt);
  }

  get sectionTitle(): string { return this.props.sectionTitle; }
  get sectionOrder(): number { return this.props.sectionOrder; }
  get level(): number { return this.props.level ?? 1; }
  get numbering(): string | undefined { return this.props.numbering; }
  get templateSectionId(): string | undefined { return this.props.templateSectionId; }
  get content(): string { return this.props.content; }
  get sourceReferences(): SourceReference[] { return [...this.props.sourceReferences]; }
  get unsupportedClaims(): string[] { return [...this.props.unsupportedClaims]; }
  get status(): SectionStatus { return this.props.status; }
  get chartConfig(): ChartConfig | null { return this.props.chartConfig ?? null; }
  get currentRevisionId(): string | undefined { return this.props.currentRevisionId; }

  /** Why the current text is not AI-written, or undefined (a written-by-AI or hand-written text clears it). */
  get generationFallback(): GenerationFallback | undefined { return this.props.generationFallback ? { ...this.props.generationFallback } : undefined; }

  get summaryCurrentAt(): Date | undefined { return this.props.summaryCurrentAt; }

  /** "This summary still matches the report": clears the out-of-date notice until the sections change again. */
  markSummaryCurrent(at: Date): void {
    this.props.summaryCurrentAt = at;
    this.touch();
  }

  /** Records the outcome of the latest write: pass nothing when the AI wrote it or a person did. */
  recordGenerationFallback(fallback: GenerationFallback | null | undefined): void {
    if (fallback && !isGenerationFallbackReason(fallback.reason)) throw DomainError.validation("Unknown generation fallback reason");
    const detail = fallback?.detail?.trim();
    if (fallback) this.props.generationFallback = { reason: fallback.reason, ...(detail ? { detail: detail.slice(0, 240) } : {}) };
    else delete this.props.generationFallback;
    this.touch();
  }

  setCurrentRevision(revisionId: string): void {
    if (!revisionId) throw DomainError.validation("Current revision id is required");
    this.props.currentRevisionId = revisionId;
    this.touch();
  }

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

  setSectionOrder(order: number): void {
    if (!Number.isInteger(order) || order < 0) {
      throw DomainError.validation("Section order must be a non-negative integer");
    }
    this.props.sectionOrder = order;
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
