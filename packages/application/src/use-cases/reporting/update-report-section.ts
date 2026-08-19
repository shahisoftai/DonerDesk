import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportSectionRepository, IReportRevisionService, IReportAssuranceService } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { SourceReference } from "@donordesk/domain";

export interface UpdateSectionInput {
  content: string;
  sourceReferences: SourceReference[];
  unsupportedClaims: string[];
  expectedVersion?: string;
}

/**
 * Manual section edit. Every mutation goes through the revision pipeline
 * (Phase 1): a new UNASSESSED revision is created, the section repoints at it,
 * and the assurance pipeline re-extracts and re-verifies assertions so stale
 * verification can never survive an edit.
 */
export class UpdateReportSectionHandler {
  constructor(
    private readonly sections: IReportSectionRepository,
    private readonly revisionService: IReportRevisionService,
    private readonly assuranceService: IReportAssuranceService,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, sectionId: string, input: UpdateSectionInput): Promise<Result<{ version: string; revisionId: string; assuranceState: string }, DomainError>> {
    const r = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };
    const sec = r.value;

    const currentVersion = sec.updatedAt.toISOString();
    if (input.expectedVersion !== undefined && input.expectedVersion !== currentVersion) {
      return {
        ok: false,
        error: DomainError.conflict(
          "This section was changed by someone else. Reload to see the latest version before saving.",
        ),
      };
    }

    const committed = await this.revisionService.commitChange({
      tenantId: ctx.tenant.tenantId,
      section: sec,
      content: input.content,
      sourceReferences: input.sourceReferences,
      unsupportedClaims: input.unsupportedClaims,
      changeOrigin: "MANUAL_EDIT",
      actorId: ctx.tenant.userId,
    });
    if (!committed.ok) return committed;

    const assessed = await this.assuranceService.assessRevision({
      ctx: { tenantId: ctx.tenant.tenantId, userId: ctx.tenant.userId },
      sectionId,
      revisionId: committed.value.id,
    });
    if (!assessed.ok) return assessed;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.section.updated",
      entityType: "report_section",
      entityId: sectionId,
      newValue: JSON.stringify({ revisionId: committed.value.id, revisionNumber: committed.value.revisionNumber, assuranceState: assessed.value.assuranceState }),
    });
    return {
      ok: true,
      value: {
        version: sec.updatedAt.toISOString(),
        revisionId: committed.value.id,
        assuranceState: assessed.value.assuranceState,
      },
    };
  }
}
