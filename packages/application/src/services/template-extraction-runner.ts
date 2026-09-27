import { DomainError, type ExtractionMergeMode, type Result, type TenantId } from "@donordesk/domain";
import type {
  IDonorTemplateRepository,
  IStructuredDocumentParser,
  ITemplateExtractionService,
  ITemplateFileStore,
  StructuredDocument,
} from "../ports/templates.js";
import type { IAuditLogger } from "../ports/core.js";

export interface TemplateExtractionJob {
  tenantId: TenantId;
  actorId: string;
  templateId: string;
  mode: ExtractionMergeMode;
}

/**
 * Runs one extraction for a template already in EXTRACTING state: re-reads the
 * original file with structure when available, calls the extractor, and
 * applies the result (or records the failure). Never throws; background-safe.
 */
export class TemplateExtractionRunner {
  constructor(
    private readonly templates: IDonorTemplateRepository,
    private readonly extractor: ITemplateExtractionService,
    private readonly files: ITemplateFileStore,
    private readonly parser: IStructuredDocumentParser,
    private readonly audit: IAuditLogger,
  ) {}

  async run(job: TemplateExtractionJob): Promise<Result<void, DomainError>> {
    const found = await this.templates.findById(job.templateId, job.tenantId);
    if (!found.ok) return found;
    const template = found.value;
    if (!template) return { ok: false, error: DomainError.notFound("DonorTemplate", job.templateId) };

    try {
      const document = await this.loadDocument(template.originalFileUrl, job.tenantId);
      const result = await this.extractor.extract({
        tenantId: job.tenantId,
        rawText: template.extractedRawText ?? "",
        document,
        language: template.language,
        donorName: template.donorName,
        reportType: template.reportType,
      });
      if (!result.ok) {
        template.failExtraction(result.error.message);
      } else {
        template.applyExtraction({ ...result.value, mode: job.mode });
      }
    } catch (error) {
      template.failExtraction(error instanceof Error ? error.message : String(error));
    }

    const saved = await this.templates.update(template, { actorId: job.actorId, changeNote: `Extraction (${job.mode})` });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: job.tenantId,
      actorId: job.actorId,
      eventType: template.status === "EXTRACTION_FAILED" ? "template.extraction_failed" : "template.extracted",
      entityType: "donor_template",
      entityId: template.id,
      projectId: template.projectId,
      newValue: JSON.stringify({ status: template.status, method: template.extractionMeta?.method, sections: template.sections.length, version: template.version }),
    });
    return { ok: true, value: undefined };
  }

  private async loadDocument(key: string | undefined, tenantId: TenantId): Promise<StructuredDocument | undefined> {
    if (!key) return undefined;
    const file = await this.files.open(key, tenantId);
    if (!file.ok) return undefined;
    if (!this.parser.supports({ fileName: file.value.fileName, mimeType: file.value.mimeType })) return undefined;
    const parsed = await this.parser.parse({ buffer: file.value.buffer, fileName: file.value.fileName, mimeType: file.value.mimeType });
    return parsed.ok ? parsed.value : undefined;
  }
}
