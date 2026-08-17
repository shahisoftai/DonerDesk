import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportSectionRepository, IReportDraftGenerator } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { RewriteSectionInput } from "@donordesk/contracts";

/**
 * Rewrites or shortens an existing report section through the generator port
 * and persists the result as a new draft version, preserving source references.
 * The generator must never invent claims; unsupported claims are carried over.
 */
export class RewriteReportSectionHandler {
  constructor(
    private readonly sections: IReportSectionRepository,
    private readonly getGenerator: (tenantId?: string) => Promise<IReportDraftGenerator>,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, sectionId: string, input: RewriteSectionInput): Promise<Result<{ version: string; content: string }, DomainError>> {
    const r = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };
    const sec = r.value;

    const generator = await this.getGenerator(ctx.tenant.tenantId.toString());
    const result = await generator.rewriteSection({
      sectionTitle: sec.sectionTitle,
      content: sec.content,
      mode: input.mode,
      audience: input.audience,
      instructions: input.instructions,
      sourceReferences: sec.sourceReferences,
    });

    sec.setContent(result.content, sec.sourceReferences, [...new Set([...sec.unsupportedClaims, ...result.unsupportedClaims])]);
    const saved = await this.sections.update(sec);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: `report.section.${input.mode.toLowerCase()}`,
      entityType: "report_section",
      entityId: sectionId,
      newValue: JSON.stringify({ mode: input.mode, audience: input.audience }),
    });
    return { ok: true, value: { version: saved.value.updatedAt.toISOString(), content: saved.value.content } };
  }
}
