import type { Result } from "@donordesk/domain";
import { DomainError, DonorTemplate, createSection, createTemplateRequirements } from "@donordesk/domain";
import type { CreateDonorTemplateInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository, ITemplateFileStore } from "../../ports/templates.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { BackgroundRunner } from "../../services/background-runner.js";
import type { TemplateExtractionRunner } from "../../services/template-extraction-runner.js";
import { toDonorTemplateView, type DonorTemplateView } from "../../services/donor-template-view.js";
import { attempt } from "./load-template.js";

/**
 * Creates a donor template. With authored sections it is ready for review
 * immediately; with only text/a file it starts in EXTRACTING and extraction
 * runs in the background (clients poll GET /v1/templates/:id).
 */
export class UploadTemplateHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly templates: IDonorTemplateRepository,
    private readonly files: ITemplateFileStore,
    private readonly extraction: TemplateExtractionRunner,
    private readonly runInBackground: BackgroundRunner,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateDonorTemplateInput): Promise<Result<DonorTemplateView, DomainError>> {
    const hasText = Boolean(input.extractedRawText?.trim());
    if (input.sections.length === 0 && !hasText) {
      return { ok: false, error: DomainError.validation("Provide template text, upload a file, or add sections manually") };
    }

    let originalFile: { url: string; name: string; mimeType: string; sha256: string } | undefined;
    if (input.originalFileKey) {
      const file = await this.files.open(input.originalFileKey, ctx.tenant.tenantId);
      if (!file.ok) return file;
      originalFile = { url: file.value.key, name: file.value.fileName, mimeType: file.value.mimeType, sha256: file.value.sha256 };
    }

    const manual = input.sections.length > 0;
    const built = attempt(() =>
      DonorTemplate.create({
        id: this.ids.generate(),
        tenantId: ctx.tenant.tenantId,
        projectId: input.projectId,
        templateName: input.templateName,
        donorName: input.donorName,
        reportType: input.reportType,
        language: input.language,
        requirements: createTemplateRequirements({ ...(input.requirements ?? {}), annexes: [...(input.requirements?.annexes ?? []), ...input.requiredAnnexes] }),
        notes: input.notes,
        originalFile,
        extractedRawText: input.extractedRawText,
        sections: input.sections.map((s, order) => createSection({ ...s, order })),
        status: manual ? "NEEDS_REVIEW" : "EXTRACTING",
        extractionMeta: manual ? { method: "MANUAL", warnings: [], extractedAt: new Date().toISOString() } : undefined,
        uploadedById: ctx.tenant.userId,
      }),
    );
    if (!built.ok) return built;
    const template = built.value;

    const saved = await this.templates.create(template);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "template.uploaded",
      entityType: "donor_template",
      entityId: template.id,
      projectId: input.projectId,
      newValue: JSON.stringify({ templateName: input.templateName, mode: manual ? "manual" : "extract", hasFile: Boolean(originalFile) }),
    });

    if (!manual) {
      this.runInBackground(async () => {
        await this.extraction.run({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, templateId: template.id, mode: "replace" });
      });
    }
    return { ok: true, value: toDonorTemplateView(template) };
  }
}
