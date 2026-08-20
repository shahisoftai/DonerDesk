import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository, IReportSectionRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface ReorderReportSectionsResult {
  sectionIds: string[];
}

/**
 * Reorders the sections of a report draft. The submitted `sectionIds` must be
 * exactly the draft's current section set (same ids, no duplicates); the order
 * is persisted by renumbering `sectionOrder` 0..n-1. Reordering never touches
 * content or revisions, so existing verification and approval state is
 * preserved. The exported document follows the same ordering.
 */
export class ReorderReportSectionsHandler {
  constructor(
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, draftId: string, sectionIds: string[]): Promise<Result<ReorderReportSectionsResult, DomainError>> {
    const draft = await this.drafts.findById(draftId, ctx.tenant.tenantId);
    if (!draft.ok) return draft;
    if (!draft.value) return { ok: false, error: DomainError.notFound("ReportDraft", draftId) };
    if (draft.value.status !== "DRAFT") {
      return {
        ok: false,
        error: DomainError.invalidTransition("Sections can only be reordered while the report is in draft."),
      };
    }

    const existing = await this.sections.findByReportDraft(draftId, ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    const current = existing.value;

    const submittedIds = [...new Set(sectionIds)];
    if (submittedIds.length !== sectionIds.length) {
      return { ok: false, error: DomainError.validation("sectionIds must not contain duplicates") };
    }
    const currentIds = new Set(current.map((s) => s.id));
    if (submittedIds.length !== currentIds.size || submittedIds.some((id) => !currentIds.has(id))) {
      return {
        ok: false,
        error: DomainError.validation("sectionIds must contain exactly the draft's current sections"),
      };
    }

    const orderById = new Map(submittedIds.map((id, index) => [id, index]));
    for (const section of current) {
      const nextOrder = orderById.get(section.id);
      if (nextOrder === undefined || section.sectionOrder === nextOrder) continue;
      section.setSectionOrder(nextOrder);
      const saved = await this.sections.update(section);
      if (!saved.ok) return saved;
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.section.reordered",
      entityType: "report_draft",
      entityId: draftId,
      newValue: JSON.stringify({ sectionIds: submittedIds }),
    });

    return { ok: true, value: { sectionIds: submittedIds } };
  }
}
