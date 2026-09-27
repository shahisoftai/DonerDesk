import type { DonorTemplate, ExtractionMeta, TemplateRequirements, TemplateSection, TemplateStatus } from "@donordesk/domain";

export interface DonorTemplateView {
  id: string;
  projectId: string;
  templateName: string;
  donorName: string;
  reportType: string;
  language: string;
  notes?: string;
  requiredAnnexes: string[];
  version: number;
  status: TemplateStatus;
  sections: TemplateSection[];
  requirements: TemplateRequirements;
  extractionMeta?: ExtractionMeta;
  originalFile?: { name?: string; mimeType?: string; available: boolean };
  hasExtractedText: boolean;
  isLibrary: boolean;
  sourceTemplateId?: string;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
}

export function toDonorTemplateView(t: DonorTemplate): DonorTemplateView {
  const file = t.originalFile;
  return {
    id: t.id,
    projectId: t.projectId,
    templateName: t.templateName,
    donorName: t.donorName,
    reportType: t.reportType,
    language: t.language,
    notes: t.notes,
    requiredAnnexes: t.requiredAnnexes,
    version: t.version,
    status: t.status,
    sections: t.sections,
    requirements: t.requirements,
    extractionMeta: t.extractionMeta,
    originalFile: file ? { name: file.name, mimeType: file.mimeType, available: true } : undefined,
    hasExtractedText: Boolean(t.extractedRawText?.trim()),
    isLibrary: t.isLibrary,
    sourceTemplateId: t.sourceTemplateId,
    uploadedById: t.uploadedById,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
