import type { Result, TenantId, DomainError, ReportRevision, ReportSection, SourceReference, GenerationFallback } from "@donordesk/domain";
import type {
  IReportRevisionService,
  IReportRevisionRepository,
  IReportSectionRepository,
} from "../ports/reporting.js";
import type { IHashService } from "../ports/core.js";

/**
 * Central content-mutation pipeline (Phase 1). Every change — generation,
 * manual edit, rewrite, shorten, auto-fix, merge — creates a new UNASSESSED
 * revision, repoints the section at that revision, and persists both. Prior
 * verification is never carried forward because the new revision starts
 * UNASSESSED and approval requires CURRENT assurance.
 */
export class ReportRevisionService implements IReportRevisionService {
  constructor(
    private readonly revisions: IReportRevisionRepository,
    private readonly sections: IReportSectionRepository,
    private readonly hasher: IHashService,
  ) {}

  async commitChange(input: {
    tenantId: TenantId;
    section: ReportSection;
    content: string;
    sourceReferences: SourceReference[];
    unsupportedClaims: string[];
    changeOrigin: ReportRevision["changeOrigin"];
    actorId: string;
    modelId?: string;
    promptVersion?: number;
    generationRunId?: string;
    /** Why this text is not AI-written. Absent when the AI wrote it or a person did: the stored reason is cleared. */
    generationFallback?: GenerationFallback;
  }): Promise<Result<ReportRevision, DomainError>> {
    const contentHash = this.hasher.normalizeAndHash(input.content);

    const created = await this.revisions.createNextForSection({
      tenantId: input.tenantId,
      sectionId: input.section.id,
      draftId: input.section.reportDraftId,
      content: input.content,
      contentHash,
      changeOrigin: input.changeOrigin,
      actorId: input.actorId,
      modelId: input.modelId,
      promptVersion: input.promptVersion,
      generationRunId: input.generationRunId,
    });
    if (!created.ok) return created;

    const section = input.section;
    section.setContent(input.content, input.sourceReferences, input.unsupportedClaims);
    section.setCurrentRevision(created.value.id);
    section.recordGenerationFallback(input.generationFallback ?? null);
    const saved = await this.sections.update(section);
    if (!saved.ok) return saved;

    return { ok: true, value: created.value };
  }
}
