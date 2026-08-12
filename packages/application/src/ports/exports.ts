import type { Result, TenantId } from "@donordesk/domain";
import type { ExportPackage } from "@donordesk/domain";

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

export interface IExportBuilder {
  build(input: {
    exportType: "WORD" | "PDF" | "EXCEL_INDICATORS" | "EVIDENCE_CHECKLIST" | "EVIDENCE_PACK_ZIP";
    projectName: string;
    reportingPeriodLabel: string;
    reportTitle: string;
    sections: Array<{ title: string; content: string; status: string }>;
    indicators: Array<{ code: string; name: string; baseline: string; target: string; achievement: string; unit?: string; status: string }>;
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
  }): Promise<ExportArtifacts>;
}
