import type { Result } from "@donordesk/domain";
import { DomainError, describeRevisionChange, summariseRevisionChange } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportSectionRepository, IReportRevisionRepository } from "../../ports/reporting.js";

/** Revisions listed in a section's history (newest first). */
export const SECTION_HISTORY_LIMIT = 20;

export interface SectionRevisionView {
  id: string;
  revisionNumber: number;
  changeOrigin: string;
  createdAt: string;
  byAi: boolean;
  isCurrent: boolean;
  content: string;
  /** The AI model and the writing-rules version that produced this version, when it was written by the AI. */
  modelId: string | null;
  promptVersion: number | null;
  /** What changed since the version before, in a sentence; null for the first version. */
  changeSummary: string | null;
}

/**
 * A section's history for "Restore previous version" (Report Editor U11/U27).
 * Restoring saves the chosen text as a new revision through the normal
 * section update (changeOrigin RESTORE) — history is never rewritten.
 */
export class ListSectionRevisionsHandler {
  constructor(
    private readonly sections: IReportSectionRepository,
    private readonly revisions: IReportRevisionRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, sectionId: string): Promise<Result<{ items: SectionRevisionView[] }, DomainError>> {
    const sectionResult = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!sectionResult.ok) return sectionResult;
    const section = sectionResult.value;
    if (!section) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };

    const revisionsResult = await this.revisions.findBySection(sectionId, ctx.tenant.tenantId);
    if (!revisionsResult.ok) return revisionsResult;
    const byNumber = new Map(revisionsResult.value.map((r) => [r.revisionNumber, r]));
    const items = [...revisionsResult.value]
      .sort((a, b) => b.revisionNumber - a.revisionNumber)
      .slice(0, SECTION_HISTORY_LIMIT)
      .map((rev) => ({
        id: rev.id,
        revisionNumber: rev.revisionNumber,
        changeOrigin: rev.changeOrigin,
        createdAt: rev.createdAt.toISOString(),
        byAi: Boolean(rev.modelId),
        isCurrent: rev.id === section.currentRevisionId,
        content: rev.content,
        modelId: rev.modelId ?? null,
        promptVersion: rev.promptVersion ?? null,
        changeSummary: byNumber.has(rev.revisionNumber - 1) ? describeRevisionChange(summariseRevisionChange(byNumber.get(rev.revisionNumber - 1)!.content, rev.content)) : null,
      }));
    return { ok: true, value: { items } };
  }
}
