import type { Result, ChangeOrigin } from "@donordesk/domain";
import { DomainError, normalizeSectionMarkdown, SECTION_MARKDOWN_MAX_LENGTH } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportSectionRepository, IReportDraftRepository, IReportRevisionService, IReportAssuranceService } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { SourceReference } from "@donordesk/domain";

export interface UpdateSectionInput {
  content: string;
  sourceReferences: SourceReference[];
  unsupportedClaims: string[];
  expectedVersion?: string;
  /**
   * Defaults to MANUAL_EDIT; REWRITE = accepted AI suggestion, RESTORE =
   * earlier revision, AUTO_FIX = a number corrected from evidence.
   */
  changeOrigin?: Extract<ChangeOrigin, "MANUAL_EDIT" | "REWRITE" | "RESTORE" | "AUTO_FIX">;
}

/**
 * Manual section edit. Every mutation goes through the revision pipeline
 * (Phase 1): a new UNASSESSED revision is created, the section repoints at it,
 * and the assurance pipeline re-extracts and re-verifies assertions so stale
 * verification can never survive an edit.
 *
 * Content is normalised to the supported markdown subset first
 * (`normalizeSectionMarkdown`), so every client — including the rich-text
 * editor — stores the same canonical form the exporters render.
 *
 * Only the current working draft can be edited (a report under review,
 * approved or superseded is read-only). Editing an approved section reopens
 * it: its approval covered different text.
 */
export class UpdateReportSectionHandler {
  constructor(
    private readonly sections: IReportSectionRepository,
    private readonly drafts: IReportDraftRepository,
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

    const draftResult = await this.drafts.findById(sec.reportDraftId, ctx.tenant.tenantId);
    if (!draftResult.ok) return draftResult;
    const draft = draftResult.value;
    if (!draft) return { ok: false, error: DomainError.notFound("ReportDraft", sec.reportDraftId) };
    if (draft.isSuperseded || draft.status !== "DRAFT") {
      return {
        ok: false,
        error: DomainError.invalidTransition(
          draft.isSuperseded
            ? "This is an older version of the report and can no longer be edited."
            : "This report is no longer a draft, so its sections cannot be edited.",
        ),
      };
    }

    const content = normalizeSectionMarkdown(input.content);
    if (content.length > SECTION_MARKDOWN_MAX_LENGTH) {
      return {
        ok: false,
        error: DomainError.validation(
          `This section is too long (${content.length.toLocaleString("en")} characters). Split it into smaller sections.`,
          { maxLength: SECTION_MARKDOWN_MAX_LENGTH },
        ),
      };
    }

    const reopened = sec.status === "APPROVED";
    if (reopened) sec.resetToDraft();

    const changeOrigin = input.changeOrigin ?? "MANUAL_EDIT";
    const committed = await this.revisionService.commitChange({
      tenantId: ctx.tenant.tenantId,
      section: sec,
      content,
      sourceReferences: input.sourceReferences,
      unsupportedClaims: input.unsupportedClaims,
      changeOrigin,
      actorId: ctx.tenant.userId,
    });
    if (!committed.ok) return committed;

    const assessed = await this.assuranceService.assessRevision({
      ctx: { tenantId: ctx.tenant.tenantId, userId: ctx.tenant.userId },
      sectionId,
      revisionId: committed.value.id,
    });
    if (!assessed.ok) return assessed;

    if (reopened) {
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "report.section.reopened",
        entityType: "report_section",
        entityId: sectionId,
        projectId: draft.projectId,
        newValue: JSON.stringify({ reason: "edited" }),
      });
    }
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.section.updated",
      entityType: "report_section",
      entityId: sectionId,
      projectId: draft.projectId,
      newValue: JSON.stringify({ revisionId: committed.value.id, revisionNumber: committed.value.revisionNumber, assuranceState: assessed.value.assuranceState, changeOrigin }),
    });

    // Assurance may update the section again (status), so the version the
    // editor sends with its next save must be read back after it.
    const latest = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!latest.ok) return latest;
    return {
      ok: true,
      value: {
        version: (latest.value ?? sec).updatedAt.toISOString(),
        revisionId: committed.value.id,
        assuranceState: assessed.value.assuranceState,
      },
    };
  }
}
