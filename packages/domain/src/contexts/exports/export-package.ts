import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type ExportType = "WORD" | "PDF" | "EXCEL_INDICATORS" | "EVIDENCE_CHECKLIST" | "EVIDENCE_PACK_ZIP";

export const EXPORT_TYPES: ExportType[] = [
  "WORD",
  "PDF",
  "EXCEL_INDICATORS",
  "EVIDENCE_CHECKLIST",
  "EVIDENCE_PACK_ZIP",
];

export interface ExportPackageProps {
  reportingPeriodId: string;
  exportType: ExportType;
  fileUrl: string;
  version: number;
  exportedById: string;
  includedFiles: string[];
}

export class ExportPackage extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: ExportPackageProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    reportingPeriodId: string;
    exportType: ExportType;
    fileUrl: string;
    version: number;
    exportedById: string;
    includedFiles?: string[];
  }): ExportPackage {
    if (!EXPORT_TYPES.includes(input.exportType)) throw DomainError.validation("Invalid export type");
    if (!input.fileUrl) throw DomainError.validation("File URL required");
    return new ExportPackage(input.id, input.tenantId, input.projectId, {
      reportingPeriodId: input.reportingPeriodId,
      exportType: input.exportType,
      fileUrl: input.fileUrl,
      version: input.version,
      exportedById: input.exportedById,
      includedFiles: input.includedFiles ?? [],
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    props: ExportPackageProps;
    createdAt: Date;
  }): ExportPackage {
    return new ExportPackage(input.id, input.tenantId, input.projectId, input.props, input.createdAt);
  }

  get reportingPeriodId(): string { return this.props.reportingPeriodId; }
  get exportType(): ExportType { return this.props.exportType; }
  get fileUrl(): string { return this.props.fileUrl; }
  get version(): number { return this.props.version; }
  get exportedById(): string { return this.props.exportedById; }
  get includedFiles(): string[] { return [...this.props.includedFiles]; }
}
