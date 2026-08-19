import type { Result } from "@donordesk/domain";
import { DomainError, ReportSection } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository, IReportSectionRepository } from "../../ports/reporting.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { CreateReportSectionInput } from "@donordesk/contracts";

export interface CreateReportSectionResult {
  id: string;
  sectionOrder: number;
}

/**
 * Adds a blank section to an existing report draft. The new section is placed
 * at the end of the draft (or at an explicit position when supplied) and is
 * created with NOT_STARTED status so it flows through the normal revision and
 * assurance pipeline once edited.
 */
export class CreateReportSectionHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateReportSectionInput): Promise<Result<CreateReportSectionResult, DomainError>> {
    const draft = await this.drafts.findById(input.reportDraftId, ctx.tenant.tenantId);
    if (!draft.ok) return draft;
    if (!draft.value) return { ok: false, error: DomainError.notFound("ReportDraft", input.reportDraftId) };
    if (draft.value.status !== "DRAFT") {
      return {
        ok: false,
        error: DomainError.invalidTransition("Sections can only be added while the report is in draft."),
      };
    }

    const existing = await this.sections.findByReportDraft(input.reportDraftId, ctx.tenant.tenantId);
    if (!existing.ok) return existing;

    const sectionOrder =
      input.sectionOrder ??
      existing.value.reduce((max, s) => (s.sectionOrder > max ? s.sectionOrder : max), -1) + 1;

    const id = this.ids.generate();
    const section = ReportSection.create({
      id,
      tenantId: ctx.tenant.tenantId.toString(),
      reportDraftId: input.reportDraftId,
      sectionTitle: input.sectionTitle.trim(),
      sectionOrder,
    });
    const saved = await this.sections.create(section);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.section.created",
      entityType: "report_section",
      entityId: id,
      newValue: JSON.stringify({ reportDraftId: input.reportDraftId, sectionTitle: input.sectionTitle, sectionOrder }),
    });

    return { ok: true, value: { id, sectionOrder } };
  }
}
