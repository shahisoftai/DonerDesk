import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { TenantId } from "../../value-objects/tenant-id.js";
import type { TemplateSection } from "./template-section.js";

export type ReportType =
  | "MONTHLY"
  | "QUARTERLY"
  | "ANNUAL"
  | "FINAL"
  | "ACTIVITY"
  | "SITUATION"
  | "CUSTOM";

export interface DonorTemplateProps {
  templateName: string;
  donorName: string;
  reportType: ReportType;
  language: string;
  requiredAnnexes: string[];
  notes?: string;
  originalFileUrl?: string;
  extractedRawText?: string;
  sections: TemplateSection[];
  version: number;
  uploadedById: string;
}

export class DonorTemplate extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantId: TenantId,
    readonly projectId: string,
    private props: DonorTemplateProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
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
    notes?: string;
    originalFileUrl?: string;
    extractedRawText?: string;
    sections?: TemplateSection[];
    version?: number;
    uploadedById: string;
  }): DonorTemplate {
    if (!input.templateName) throw DomainError.validation("Template name required");
    if (!input.donorName) throw DomainError.validation("Donor name required");
    return new DonorTemplate(input.id, input.tenantId, input.projectId, {
      templateName: input.templateName,
      donorName: input.donorName,
      reportType: input.reportType,
      language: input.language,
      requiredAnnexes: input.requiredAnnexes ?? [],
      notes: input.notes,
      originalFileUrl: input.originalFileUrl,
      extractedRawText: input.extractedRawText,
      sections: input.sections ?? [],
      version: input.version ?? 1,
      uploadedById: input.uploadedById,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: TenantId;
    projectId: string;
    props: DonorTemplateProps;
    createdAt: Date;
  }): DonorTemplate {
    return new DonorTemplate(input.id, input.tenantId, input.projectId, input.props, input.createdAt);
  }

  get templateName(): string { return this.props.templateName; }
  get donorName(): string { return this.props.donorName; }
  get reportType(): ReportType { return this.props.reportType; }
  get language(): string { return this.props.language; }
  get requiredAnnexes(): string[] { return [...this.props.requiredAnnexes]; }
  get notes(): string | undefined { return this.props.notes; }
  get originalFileUrl(): string | undefined { return this.props.originalFileUrl; }
  get extractedRawText(): string | undefined { return this.props.extractedRawText; }
  get sections(): TemplateSection[] { return [...this.props.sections]; }
  get version(): number { return this.props.version; }
  get uploadedById(): string { return this.props.uploadedById; }

  setSections(sections: TemplateSection[]): void {
    this.props.sections = sections.map((s, i) => ({ ...s, order: i }));
    this.touch();
  }

  setExtractedText(text: string, fileUrl?: string): void {
    this.props.extractedRawText = text;
    if (fileUrl) this.props.originalFileUrl = fileUrl;
    this.touch();
  }

  bumpVersion(): DonorTemplate {
    return DonorTemplate.create({
      id: this._id,
      tenantId: this.tenantId,
      projectId: this.projectId,
      templateName: this.props.templateName,
      donorName: this.props.donorName,
      reportType: this.props.reportType,
      language: this.props.language,
      requiredAnnexes: this.props.requiredAnnexes,
      notes: this.props.notes,
      originalFileUrl: this.props.originalFileUrl,
      extractedRawText: this.props.extractedRawText,
      sections: this.props.sections,
      version: this.props.version + 1,
      uploadedById: this.props.uploadedById,
    });
  }
}
