import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { TenantId } from "../../value-objects/tenant-id.js";
import { reportableSections, validateSectionTree, type TemplateSection } from "./template-section.js";
import { createTemplateRequirements, emptyTemplateRequirements, type TemplateRequirements } from "./template-requirements.js";
import { mergeExtractedSections } from "./merge-extracted-sections.js";

export type ReportType =
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMI_ANNUAL"
  | "ANNUAL"
  | "FINAL"
  | "ACTIVITY"
  | "SITUATION"
  | "CUSTOM";

/**
 * EXTRACTING → NEEDS_REVIEW → REVIEWED. EXTRACTION_FAILED is recoverable by
 * re-extracting or by authoring sections manually. Only REVIEWED templates can
 * drive report generation.
 */
export type TemplateStatus = "EXTRACTING" | "NEEDS_REVIEW" | "REVIEWED" | "EXTRACTION_FAILED";

export type ExtractionMethod = "LLM" | "HEURISTIC" | "CANONICAL" | "MANUAL";

export interface ExtractionMeta {
  method: ExtractionMethod;
  model?: string;
  promptVersion?: string;
  warnings: string[];
  extractedAt: string;
  durationMs?: number;
}

export interface OriginalTemplateFile {
  url: string;
  name?: string;
  mimeType?: string;
  sha256?: string;
}

export interface TemplateVersionSnapshot {
  version: number;
  sections: TemplateSection[];
  requirements: TemplateRequirements;
}

export interface DonorTemplateProps {
  templateName: string;
  donorName: string;
  reportType: ReportType;
  language: string;
  notes?: string;
  originalFile?: OriginalTemplateFile;
  extractedRawText?: string;
  sections: TemplateSection[];
  requirements: TemplateRequirements;
  status: TemplateStatus;
  extractionMeta?: ExtractionMeta;
  version: number;
  uploadedById: string;
  isLibrary: boolean;
  sourceTemplateId?: string;
}

export type ExtractionMergeMode = "replace" | "merge";

function requireText(value: string | undefined, label: string): string {
  const t = value?.trim();
  if (!t) throw DomainError.validation(`${label} required`);
  if (t.length > 200) throw DomainError.validation(`${label} must be at most 200 characters`);
  return t;
}

function orderedSections(sections: readonly TemplateSection[]): TemplateSection[] {
  const next = sections.map((s, order) => ({ ...s, order }));
  validateSectionTree(next);
  return next;
}

export class DonorTemplate extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantId: TenantId,
    readonly projectId: string,
    private props: DonorTemplateProps,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  static create(input: {
    id: string;
    tenantId: TenantId;
    projectId: string;
    templateName: string;
    donorName: string;
    reportType: ReportType;
    language: string;
    requiredAnnexes?: string[];
    requirements?: TemplateRequirements;
    notes?: string;
    originalFile?: OriginalTemplateFile;
    extractedRawText?: string;
    sections?: TemplateSection[];
    status?: TemplateStatus;
    extractionMeta?: ExtractionMeta;
    version?: number;
    uploadedById: string;
    isLibrary?: boolean;
    sourceTemplateId?: string;
  }): DonorTemplate {
    const requirements = input.requirements ?? createTemplateRequirements({ annexes: input.requiredAnnexes ?? [] });
    return new DonorTemplate(input.id, input.tenantId, input.projectId, {
      templateName: requireText(input.templateName, "Template name"),
      donorName: requireText(input.donorName, "Donor name"),
      reportType: input.reportType,
      language: input.language,
      notes: input.notes,
      originalFile: input.originalFile,
      extractedRawText: input.extractedRawText,
      sections: orderedSections(input.sections ?? []),
      requirements,
      status: input.status ?? ((input.sections?.length ?? 0) > 0 ? "NEEDS_REVIEW" : "EXTRACTING"),
      extractionMeta: input.extractionMeta,
      version: input.version ?? 1,
      uploadedById: input.uploadedById,
      isLibrary: input.isLibrary ?? false,
      sourceTemplateId: input.sourceTemplateId,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: TenantId;
    projectId: string;
    props: DonorTemplateProps;
    createdAt: Date;
    updatedAt?: Date;
  }): DonorTemplate {
    return new DonorTemplate(input.id, input.tenantId, input.projectId, input.props, input.createdAt, input.updatedAt);
  }

  get templateName(): string { return this.props.templateName; }
  get donorName(): string { return this.props.donorName; }
  get reportType(): ReportType { return this.props.reportType; }
  get language(): string { return this.props.language; }
  /** Names of donor-required annexes (derived from structured requirements). */
  get requiredAnnexes(): string[] { return this.props.requirements.annexes.filter((a) => a.required).map((a) => a.name); }
  get notes(): string | undefined { return this.props.notes; }
  get originalFile(): OriginalTemplateFile | undefined { return this.props.originalFile ? { ...this.props.originalFile } : undefined; }
  get originalFileUrl(): string | undefined { return this.props.originalFile?.url; }
  get extractedRawText(): string | undefined { return this.props.extractedRawText; }
  get sections(): TemplateSection[] { return [...this.props.sections]; }
  /** Sections that become report sections (excludes reference-only guidance). */
  get reportSections(): TemplateSection[] { return reportableSections(this.props.sections); }
  get requirements(): TemplateRequirements { return structuredClone(this.props.requirements); }
  get status(): TemplateStatus { return this.props.status; }
  get extractionMeta(): ExtractionMeta | undefined { return this.props.extractionMeta ? structuredClone(this.props.extractionMeta) : undefined; }
  get version(): number { return this.props.version; }
  get uploadedById(): string { return this.props.uploadedById; }
  get isLibrary(): boolean { return this.props.isLibrary; }
  get sourceTemplateId(): string | undefined { return this.props.sourceTemplateId; }
  get isReviewed(): boolean { return this.props.status === "REVIEWED"; }

  snapshot(): TemplateVersionSnapshot {
    return { version: this.props.version, sections: this.sections, requirements: this.requirements };
  }

  updateMetadata(input: { templateName?: string; donorName?: string; reportType?: ReportType; language?: string; notes?: string | null }): void {
    if (input.templateName !== undefined) this.props.templateName = requireText(input.templateName, "Template name");
    if (input.donorName !== undefined) this.props.donorName = requireText(input.donorName, "Donor name");
    if (input.reportType !== undefined) this.props.reportType = input.reportType;
    if (input.language !== undefined) this.props.language = input.language;
    if (input.notes !== undefined) this.props.notes = input.notes?.trim() || undefined;
    this.touch();
  }

  /** Human edit of the structure and/or requirements; always a new version. */
  revise(input: { sections?: TemplateSection[]; requirements?: TemplateRequirements }): void {
    this.assertNotExtracting();
    if (input.sections) this.props.sections = orderedSections(input.sections);
    if (input.requirements) this.props.requirements = input.requirements;
    if (this.props.status === "EXTRACTION_FAILED" && this.props.sections.length > 0) this.props.status = "NEEDS_REVIEW";
    // An approved template stays approved only while every section is reviewed.
    if (this.props.status === "REVIEWED" && this.props.sections.some((s) => s.reviewStatus !== "REVIEWED")) this.props.status = "NEEDS_REVIEW";
    this.bumpVersion();
  }

  /** Legacy entry point: replace sections (a new version). */
  setSections(sections: TemplateSection[]): void {
    this.revise({ sections });
  }

  setExtractedText(text: string): void {
    this.props.extractedRawText = text;
    this.touch();
  }

  attachOriginalFile(file: OriginalTemplateFile): void {
    if (!file.url) throw DomainError.validation("Original file url required");
    this.props.originalFile = { ...file };
    this.touch();
  }

  startExtraction(): void {
    this.assertNotExtracting();
    if (!this.props.extractedRawText?.trim()) throw DomainError.validation("Template has no extracted text to analyse");
    this.props.status = "EXTRACTING";
    this.touch();
  }

  applyExtraction(input: { sections: TemplateSection[]; requirements: TemplateRequirements; meta: ExtractionMeta; mode: ExtractionMergeMode }): void {
    const drafts = input.sections.map((s) => ({ ...s, reviewStatus: "DRAFT" as const }));
    const hadContent = this.props.sections.length > 0;
    this.props.sections = orderedSections(input.mode === "merge" && hadContent ? mergeExtractedSections(this.props.sections, drafts) : drafts);
    this.props.requirements = input.mode === "merge" && hadContent ? mergeRequirements(this.props.requirements, input.requirements) : input.requirements;
    this.props.extractionMeta = { ...input.meta, warnings: [...input.meta.warnings] };
    this.props.status = "NEEDS_REVIEW";
    this.bumpVersion();
  }

  failExtraction(reason: string): void {
    this.props.status = "EXTRACTION_FAILED";
    this.props.extractionMeta = {
      method: this.props.extractionMeta?.method ?? "HEURISTIC",
      warnings: [reason],
      extractedAt: new Date().toISOString(),
    };
    this.touch();
  }

  /** Human sign-off. Every section that will appear in the report must be reviewed. */
  markReviewed(): void {
    this.assertNotExtracting();
    const reportable = this.reportSections;
    if (reportable.length === 0) throw DomainError.validation("Add at least one report section before marking the template reviewed");
    const pending = this.props.sections.filter((s) => s.reviewStatus !== "REVIEWED");
    if (pending.length > 0) {
      throw DomainError.validation(`${pending.length} section(s) still need review: ${pending.slice(0, 5).map((s) => s.title).join(", ")}`);
    }
    this.props.status = "REVIEWED";
    this.touch();
  }

  /** Re-opens review after structural edits that must be re-approved. */
  reopenReview(): void {
    if (this.props.status === "REVIEWED") {
      this.props.status = "NEEDS_REVIEW";
      this.touch();
    }
  }

  setLibrary(isLibrary: boolean): void {
    this.props.isLibrary = isLibrary;
    this.touch();
  }

  /** A fresh copy for another project, starting at version 1 with provenance. */
  cloneForProject(input: { id: string; projectId: string; uploadedById: string }): DonorTemplate {
    return DonorTemplate.create({
      id: input.id,
      tenantId: this.tenantId,
      projectId: input.projectId,
      templateName: this.props.templateName,
      donorName: this.props.donorName,
      reportType: this.props.reportType,
      language: this.props.language,
      requirements: this.requirements,
      notes: this.props.notes,
      originalFile: this.originalFile,
      extractedRawText: this.props.extractedRawText,
      sections: this.sections,
      status: this.props.status === "REVIEWED" ? "REVIEWED" : "NEEDS_REVIEW",
      extractionMeta: this.extractionMeta,
      uploadedById: input.uploadedById,
      sourceTemplateId: this._id,
    });
  }

  private bumpVersion(): void {
    this.props.version += 1;
    this.touch();
  }

  private assertNotExtracting(): void {
    if (this.props.status === "EXTRACTING") throw DomainError.conflict("Template extraction is still running");
  }
}

function mergeByKey<T>(current: readonly T[], incoming: readonly T[], keyOf: (v: T) => string): T[] {
  const keys = new Set(current.map(keyOf));
  return [...current, ...incoming.filter((v) => !keys.has(keyOf(v)))];
}

/** Keeps every human-authored requirement and adds newly extracted ones. */
function mergeRequirements(current: TemplateRequirements, incoming: TemplateRequirements): TemplateRequirements {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const base = current ?? emptyTemplateRequirements();
  return {
    reportTitle: base.reportTitle ?? incoming.reportTitle,
    reportingFrequency: base.reportingFrequency ?? incoming.reportingFrequency,
    submission: {
      instructions: mergeByKey(base.submission.instructions, incoming.submission.instructions, norm),
      deadlineRule: base.submission.deadlineRule ?? incoming.submission.deadlineRule,
      deadlineOffsetDays: base.submission.deadlineOffsetDays ?? incoming.submission.deadlineOffsetDays,
      channel: base.submission.channel ?? incoming.submission.channel,
      format: base.submission.format ?? incoming.submission.format,
    },
    formatting: {
      rules: mergeByKey(base.formatting.rules, incoming.formatting.rules, norm),
      maxPages: base.formatting.maxPages ?? incoming.formatting.maxPages,
      font: base.formatting.font ?? incoming.formatting.font,
    },
    annexes: mergeByKey(base.annexes, incoming.annexes, (a) => norm(a.name)),
    indicatorRequirements: mergeByKey(base.indicatorRequirements, incoming.indicatorRequirements, (r) => norm(r.text)),
    compliance: mergeByKey(base.compliance, incoming.compliance, (c) => norm(c.text)),
    generalInstructions: mergeByKey(base.generalInstructions, incoming.generalInstructions, norm),
  };
}
