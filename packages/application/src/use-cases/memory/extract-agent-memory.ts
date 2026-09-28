import type { Result, TenantId } from "@donordesk/domain";
import { DomainError, excludeNumericHunks } from "@donordesk/domain";
import type {
  IReportRevisionRepository,
  IReportSectionRepository,
  IReportDraftRepository,
  IReportingPeriodRepository,
} from "../../ports/reporting.js";
import type { IAgentMemoryRepository, IAgentMemoryExtractor } from "../../ports/agent-memory.js";

export interface ExtractAgentMemoryInput {
  tenantId: TenantId;
  sectionId: string;
  /** The MANUAL_EDIT revision `UpdateReportSectionHandler` just committed. */
  revisionId: string;
}

/**
 * Orchestrates read -> filter -> extract -> propose for one section edit.
 * Triggered by `UpdateReportSectionHandler` (via `BackgroundRunner`) only
 * when both the platform `AGENT_MEMORY_ENABLED` flag and the tenant's
 * `Organization.agentMemoryEnabled` toggle are on — that gating happens at
 * the composition root, not here, so this handler has zero knowledge of
 * flags and can be unit-tested in isolation.
 *
 * A human editing their own prior manual edit (MANUAL_EDIT -> MANUAL_EDIT) is
 * not a signal about AI output, so it is a deliberate no-op, not an error.
 */
export class ExtractAgentMemoryHandler {
  constructor(
    private readonly revisions: IReportRevisionRepository,
    private readonly sections: IReportSectionRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly extractor: IAgentMemoryExtractor,
    private readonly agentMemory: IAgentMemoryRepository,
  ) {}

  async handle(input: ExtractAgentMemoryInput): Promise<Result<{ proposed: number }, DomainError>> {
    const revisionResult = await this.revisions.findById(input.revisionId, input.tenantId);
    if (!revisionResult.ok) return revisionResult;
    const revision = revisionResult.value;
    if (!revision || revision.changeOrigin !== "MANUAL_EDIT" || !revision.parentRevisionId) {
      return { ok: true, value: { proposed: 0 } };
    }

    const parentResult = await this.revisions.findById(revision.parentRevisionId, input.tenantId);
    if (!parentResult.ok) return parentResult;
    const parent = parentResult.value;
    if (!parent || (parent.changeOrigin !== "GENERATION" && parent.changeOrigin !== "REWRITE")) {
      return { ok: true, value: { proposed: 0 } };
    }

    const sectionResult = await this.sections.findById(input.sectionId, input.tenantId);
    if (!sectionResult.ok) return sectionResult;
    const section = sectionResult.value;
    if (!section) return { ok: false, error: DomainError.notFound("ReportSection", input.sectionId) };

    const donorTemplateId = await this.resolveDonorTemplateId(section.reportDraftId, input.tenantId);

    const priorContent = excludeNumericHunks(parent.content);
    const editedContent = excludeNumericHunks(revision.content);

    const extracted = await this.extractor.extract({
      tenantId: input.tenantId,
      sectionTitle: section.sectionTitle,
      donorTemplateId,
      priorContent,
      editedContent,
    });
    if (!extracted.ok) return extracted;
    if (extracted.value.length === 0) return { ok: true, value: { proposed: 0 } };

    // The extractor knows nothing about revision identity (it only sees
    // filtered text); this handler owns provenance so every extractor
    // implementation is exempt from re-deriving it.
    const now = new Date();
    const candidates = extracted.value.map((candidate) => ({
      ...candidate,
      provenance: {
        sourceRevisionId: revision.id,
        parentRevisionId: parent.id,
        sectionId: input.sectionId,
        occurrenceCount: 1,
        lastObservedAt: now,
      },
    }));

    const proposed = await this.agentMemory.proposeMany(input.tenantId, candidates);
    if (!proposed.ok) return proposed;

    return { ok: true, value: { proposed: proposed.value.length } };
  }

  private async resolveDonorTemplateId(reportDraftId: string, tenantId: TenantId): Promise<string | undefined> {
    const draftResult = await this.drafts.findById(reportDraftId, tenantId);
    if (!draftResult.ok || !draftResult.value) return undefined;
    const periodResult = await this.periods.findById(draftResult.value.reportingPeriodId, tenantId);
    if (!periodResult.ok || !periodResult.value) return undefined;
    return periodResult.value.donorTemplateId;
  }
}
