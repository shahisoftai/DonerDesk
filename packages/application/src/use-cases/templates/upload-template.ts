import type { Result } from "@donordesk/domain";
import { DomainError, DonorTemplate } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository, ITemplateExtractionService } from "../../ports/templates.js";
import type { IIdGenerator, IAuditLogger, INotificationPort } from "../../ports/core.js";
import type { CreateDonorTemplateInput } from "@donordesk/contracts";
import { createSection } from "@donordesk/domain";

export class UploadTemplateHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly templates: IDonorTemplateRepository,
    private readonly extraction: ITemplateExtractionService,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateDonorTemplateInput): Promise<Result<{ id: string; sections: unknown[]; summary: string }, DomainError>> {
    const id = this.ids.generate();
    let sections = input.sections.map((s) => createSection(s));
    let summary = "";
    if (input.extractedRawText && input.sections.length === 0) {
      const result = await this.extraction.extractSections({
        rawText: input.extractedRawText,
        language: input.language,
      });
      sections = result.sections;
      summary = result.summary;
    }
    const t = DonorTemplate.create({
      id,
      tenantId: ctx.tenant.tenantId,
      projectId: input.projectId,
      templateName: input.templateName,
      donorName: input.donorName,
      reportType: input.reportType,
      language: input.language,
      requiredAnnexes: input.requiredAnnexes,
      notes: input.notes,
      originalFileUrl: input.originalFileUrl,
      extractedRawText: input.extractedRawText,
      sections,
      uploadedById: ctx.tenant.userId,
    });
    const saved = await this.templates.create(t);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "template.uploaded",
      entityType: "donor_template",
      entityId: id,
      projectId: input.projectId,
      newValue: input.templateName,
    });
    return { ok: true, value: { id, sections, summary } };
  }
}
