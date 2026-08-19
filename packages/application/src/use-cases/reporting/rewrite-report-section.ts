import type { Result } from "@donordesk/domain";
import { DomainError, ReportGenerationRun } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportSectionRepository, IReportDraftRepository, IReportDraftGenerator, IReportRevisionService, IReportAssuranceService, IGenerationRunRepository } from "../../ports/reporting.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { RewriteSectionInput } from "@donordesk/contracts";

/**
 * Rewrites or shortens an existing report section through the generator port
 * and persists the result as a new revision through the single mutation
 * pipeline, preserving source references. The generator must never invent
 * claims; unsupported claims are carried over. The rewrite always produces a
 * new child generation run with prompt/response hashes, re-extracts
 * assertions, and re-runs assurance.
 */
export class RewriteReportSectionHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly getGenerator: (tenantId?: string) => Promise<IReportDraftGenerator>,
    private readonly revisionService: IReportRevisionService,
    private readonly assuranceService: IReportAssuranceService,
    private readonly generationRuns: IGenerationRunRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, sectionId: string, input: RewriteSectionInput): Promise<Result<{ version: string; content: string; revisionId: string; assuranceState: string; generationRunId: string }, DomainError>> {
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

    const draftResult = await this.drafts.findById(sec.reportDraftId, ctx.tenant.tenantId);
    if (!draftResult.ok) return draftResult;
    const draft = draftResult.value;
    if (!draft) return { ok: false, error: DomainError.notFound("ReportDraft", sec.reportDraftId) };

    const childRun = ReportGenerationRun.create({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: draft.projectId,
      reportingPeriodId: draft.reportingPeriodId,
      draftId: draft.id,
      templateVersion: 1,
      profileVersion: 1,
      plannerVersion: 1,
      indicatorUpdateIds: [],
      activityIds: [],
      evidenceIds: [],
      verifiedFindings: [],
      modelId: generator.model.modelId,
      promptVersion: generator.model.promptVersion,
      generationParams: { mode: input.mode, audience: input.audience, changeOrigin: "REWRITE" },
      sectionId,
      promptHash: result.promptHash,
      responseHash: result.responseHash,
    });
    const savedRun = await this.generationRuns.create(childRun);
    if (!savedRun.ok) return savedRun;

    const mergedUnsupported = [...new Set([...sec.unsupportedClaims, ...result.unsupportedClaims])];
    const committed = await this.revisionService.commitChange({
      tenantId: ctx.tenant.tenantId,
      section: sec,
      content: result.content,
      sourceReferences: sec.sourceReferences,
      unsupportedClaims: mergedUnsupported,
      changeOrigin: "REWRITE",
      actorId: ctx.tenant.userId,
      modelId: generator.model.modelId,
      promptVersion: generator.model.promptVersion,
      generationRunId: childRun.id,
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
      eventType: `report.section.${input.mode.toLowerCase()}`,
      entityType: "report_section",
      entityId: sectionId,
      newValue: JSON.stringify({ mode: input.mode, audience: input.audience, revisionId: committed.value.id, revisionNumber: committed.value.revisionNumber, assuranceState: assessed.value.assuranceState, generationRunId: childRun.id }),
    });
    return {
      ok: true,
      value: {
        version: sec.updatedAt.toISOString(),
        content: sec.content,
        revisionId: committed.value.id,
        assuranceState: assessed.value.assuranceState,
        generationRunId: childRun.id,
      },
    };
  }
}
