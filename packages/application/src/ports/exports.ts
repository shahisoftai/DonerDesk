import type { Result, TenantId } from "@donordesk/domain";
import type { ExportPackage, ChartConfig } from "@donordesk/domain";

export interface IExportRepository {
  create(e: ExportPackage): Promise<Result<ExportPackage>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ExportPackage | null>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<ExportPackage[]>>;
}

export interface ExportArtifacts {
  fileBuffer: Buffer;
  contentType: string;
  fileName: string;
}

export interface ExportChartInput {
  /** Section title this chart belongs to (used as its caption). */
  sectionTitle: string;
  config: ChartConfig;
  indicators: Array<{
    code: string;
    name: string;
    baseline: string;
    target: string;
    unit?: string;
    achievement: string;
    status: string;
  }>;
}

export type ExportIntent = "INTERNAL_REVIEW" | "DONOR_SUBMISSION";

export interface IExportBuilder {
  build(input: {
    exportType: "WORD" | "PDF" | "EXCEL_INDICATORS" | "EVIDENCE_CHECKLIST" | "EVIDENCE_PACK_ZIP" | "DONOR_TEMPLATE";
    exportIntent: ExportIntent;
    submissionSnapshotId?: string;
    projectName: string;
    reportingPeriodLabel: string;
    reportTitle: string;
    sections: Array<{ title: string; content: string; status: string }>;
    indicators: Array<{ code: string; name: string; baseline: string; target: string; achievement: string; unit?: string; status: string }>;
    charts?: ExportChartInput[];
    activities: Array<{ title: string; date: string; location?: string; participants: number }>;
    checklist: Array<{ title: string; severity: string; status: string; resolutionNotes?: string }>;
    evidenceItems: Array<{
      id: string;
      fileName: string;
      title: string;
      type: string;
      verificationStatus: string;
      confidentiality: string;
    }>;
    includeSensitive: boolean;
    /** Watermark text for internal previews; donor submissions must never be watermarked. */
    watermark?: string;
    /** Present only when the period has an APPROVED, locked donor-template
     * mapping and rendering is enabled — `buildDonorTemplate()` uses this to
     * populate the donor's own uploaded template via docxtpl instead of the
     * generic fallback DOCX. Absent (undefined) is the default/safe state
     * for every tenant that has not gone through the mapping flow. */
    donorTemplate?: {
      /** Storage key for the cached "templated" DOCX (placeholders already
       * physically inserted at mapping-approval time). */
      templatedFileKey: string;
      /** placeholderKey -> the matching report section's title, so the
       * builder can look up its content from `sections` by title. */
      placeholderSections: Array<{ placeholderKey: string; sectionTitle: string }>;
    };
  }): Promise<ExportArtifacts>;
}
