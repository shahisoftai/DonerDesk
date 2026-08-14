import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type EvidenceType =
  | "ATTENDANCE_SHEET"
  | "PHOTO"
  | "DISTRIBUTION_LIST"
  | "TRAINING_RECORD"
  | "FIELD_VISIT_REPORT"
  | "MONITORING_REPORT"
  | "KOBO_ODK_EXPORT"
  | "PROCUREMENT_DOCUMENT"
  | "APPROVAL_DOCUMENT"
  | "BENEFICIARY_LIST"
  | "MEETING_MINUTES"
  | "CASE_STUDY"
  | "FINANCIAL_DOCUMENT"
  | "SUPPLIER_DOCUMENT"
  | "DONOR_COMMUNICATION"
  | "OTHER";

export const EVIDENCE_TYPES: EvidenceType[] = [
  "ATTENDANCE_SHEET",
  "PHOTO",
  "DISTRIBUTION_LIST",
  "TRAINING_RECORD",
  "FIELD_VISIT_REPORT",
  "MONITORING_REPORT",
  "KOBO_ODK_EXPORT",
  "PROCUREMENT_DOCUMENT",
  "APPROVAL_DOCUMENT",
  "BENEFICIARY_LIST",
  "MEETING_MINUTES",
  "CASE_STUDY",
  "FINANCIAL_DOCUMENT",
  "SUPPLIER_DOCUMENT",
  "DONOR_COMMUNICATION",
  "OTHER",
];

export type ConfidentialityLevel = "PUBLIC" | "INTERNAL" | "SENSITIVE" | "HIGHLY_SENSITIVE";

export const CONFIDENTIALITY_LEVELS: ConfidentialityLevel[] = ["PUBLIC", "INTERNAL", "SENSITIVE", "HIGHLY_SENSITIVE"];

export type EvidenceVerificationStatus =
  | "UPLOADED"
  | "AI_TAGGED"
  | "PENDING_REVIEW"
  | "VERIFIED"
  | "NEEDS_CORRECTION"
  | "REJECTED"
  | "ARCHIVED";

export const EVIDENCE_VERIFICATION_STATUSES: EvidenceVerificationStatus[] = [
  "UPLOADED",
  "AI_TAGGED",
  "PENDING_REVIEW",
  "VERIFIED",
  "NEEDS_CORRECTION",
  "REJECTED",
  "ARCHIVED",
];

export type StorageProvider = "LOCAL" | "GOOGLE_DRIVE" | "R2";

export const STORAGE_PROVIDERS: StorageProvider[] = ["LOCAL", "GOOGLE_DRIVE", "R2"];

export interface SuggestedTag {
  field: "evidenceType" | "activityId" | "indicatorId" | "reportingPeriodId" | "location";
  value: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  accepted: boolean;
}

export interface EvidenceFileProps {
  fileName: string;
  title: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  evidenceType: EvidenceType;
  storageProvider: StorageProvider;
  driveFileId?: string;
  driveWebLink?: string;
  storageKey?: string;
  reportingPeriodId?: string;
  activityId?: string;
  indicatorId?: string;
  location?: string;
  activityDate?: Date;
  uploadedById: string;
  verificationStatus: EvidenceVerificationStatus;
  confidentialityLevel: ConfidentialityLevel;
  notes?: string;
  aiSummary?: string;
  aiSuggestedTags: SuggestedTag[];
  sensitivityWarning?: string;
}

export class EvidenceFile extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: EvidenceFileProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    fileName: string;
    title: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    evidenceType: EvidenceType;
    storageProvider?: StorageProvider;
    driveFileId?: string;
    driveWebLink?: string;
    storageKey?: string;
    reportingPeriodId?: string;
    activityId?: string;
    indicatorId?: string;
    location?: string;
    activityDate?: Date;
    uploadedById: string;
    confidentialityLevel?: ConfidentialityLevel;
    notes?: string;
  }): EvidenceFile {
    if (!input.fileName) throw DomainError.validation("File name required");
    if (!input.title) throw DomainError.validation("Title required");
    if (!input.fileUrl) throw DomainError.validation("File URL required");
    const confidentialityLevel: ConfidentialityLevel = input.confidentialityLevel ?? "INTERNAL";
    const storageProvider: StorageProvider = input.storageProvider ?? "LOCAL";
    return new EvidenceFile(input.id, input.tenantId, input.projectId, {
      fileName: input.fileName,
      title: input.title,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
      fileSize: input.fileSize,
      evidenceType: input.evidenceType,
      storageProvider,
      driveFileId: input.driveFileId,
      driveWebLink: input.driveWebLink,
      storageKey: input.storageKey,
      reportingPeriodId: input.reportingPeriodId,
      activityId: input.activityId,
      indicatorId: input.indicatorId,
      location: input.location,
      activityDate: input.activityDate,
      uploadedById: input.uploadedById,
      verificationStatus: "UPLOADED",
      confidentialityLevel,
      notes: input.notes,
      aiSuggestedTags: [],
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    props: EvidenceFileProps;
    createdAt: Date;
  }): EvidenceFile {
    return new EvidenceFile(input.id, input.tenantId, input.projectId, input.props, input.createdAt);
  }

  get fileName(): string { return this.props.fileName; }
  get title(): string { return this.props.title; }
  get fileUrl(): string { return this.props.fileUrl; }
  get fileType(): string { return this.props.fileType; }
  get fileSize(): number { return this.props.fileSize; }
  get storageProvider(): StorageProvider { return this.props.storageProvider; }
  get driveFileId(): string | undefined { return this.props.driveFileId; }
  get driveWebLink(): string | undefined { return this.props.driveWebLink; }
  get storageKey(): string | undefined { return this.props.storageKey; }
  get evidenceType(): EvidenceType { return this.props.evidenceType; }
  get reportingPeriodId(): string | undefined { return this.props.reportingPeriodId; }
  get activityId(): string | undefined { return this.props.activityId; }
  get indicatorId(): string | undefined { return this.props.indicatorId; }
  get location(): string | undefined { return this.props.location; }
  get activityDate(): Date | undefined { return this.props.activityDate; }
  get uploadedById(): string { return this.props.uploadedById; }
  get verificationStatus(): EvidenceVerificationStatus { return this.props.verificationStatus; }
  get confidentialityLevel(): ConfidentialityLevel { return this.props.confidentialityLevel; }
  get notes(): string | undefined { return this.props.notes; }
  get aiSummary(): string | undefined { return this.props.aiSummary; }
  get aiSuggestedTags(): SuggestedTag[] { return [...this.props.aiSuggestedTags]; }
  get sensitivityWarning(): string | undefined { return this.props.sensitivityWarning; }

  updateMetadata(patch: Partial<Omit<EvidenceFileProps, "fileUrl" | "uploadedById" | "aiSuggestedTags" | "storageProvider" | "driveFileId" | "driveWebLink" | "storageKey">>): void {
    this.props = { ...this.props, ...patch };
    this.touch();
  }

  changeConfidentiality(level: ConfidentialityLevel): void {
    if (!CONFIDENTIALITY_LEVELS.includes(level)) throw DomainError.validation("Invalid confidentiality level");
    this.props.confidentialityLevel = level;
    this.touch();
  }

  setAiSuggestions(summary: string, tags: SuggestedTag[], sensitivity?: string): void {
    this.props.aiSummary = summary;
    this.props.aiSuggestedTags = tags;
    this.props.sensitivityWarning = sensitivity;
    this.props.verificationStatus = "AI_TAGGED";
    this.touch();
  }

  acceptTags(tagIndices: number[]): void {
    this.props.aiSuggestedTags = this.props.aiSuggestedTags.map((t, i) =>
      tagIndices.includes(i) ? { ...t, accepted: true } : t,
    );
    this.touch();
  }

  rejectAllTags(): void {
    this.props.aiSuggestedTags = [];
    this.touch();
  }

  verify(): void {
    if (this.props.verificationStatus === "VERIFIED") return;
    this.props.verificationStatus = "VERIFIED";
    this.touch();
  }

  requestCorrection(): void {
    this.props.verificationStatus = "NEEDS_CORRECTION";
    this.touch();
  }

  reject(): void {
    this.props.verificationStatus = "REJECTED";
    this.touch();
  }

  archive(): void {
    this.props.verificationStatus = "ARCHIVED";
    this.touch();
  }

  isSensitive(): boolean {
    return this.props.confidentialityLevel === "SENSITIVE" || this.props.confidentialityLevel === "HIGHLY_SENSITIVE";
  }
}
