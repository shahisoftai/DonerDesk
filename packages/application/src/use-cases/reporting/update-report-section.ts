import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportSectionRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { SourceReference } from "@donordesk/domain";

export interface UpdateSectionInput {
  content: string;
  sourceReferences: SourceReference[];
  unsupportedClaims: string[];
}

export class UpdateReportSectionHandler {
  constructor(private readonly sections: IReportSectionRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, sectionId: string, input: UpdateSectionInput): Promise<Result<void, DomainError>> {
    const r = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };
    const sec = r.value;
    sec.setContent(input.content, input.sourceReferences, input.unsupportedClaims);
    const saved = await this.sections.update(sec);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.section.updated",
      entityType: "report_section",
      entityId: sectionId,
    });
    return { ok: true, value: undefined };
  }
}
