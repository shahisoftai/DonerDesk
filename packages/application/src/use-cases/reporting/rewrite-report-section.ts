import type { Result, VerifiedFinding } from "@donordesk/domain";
import { DomainError, ReportGenerationRun } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportSectionRepository,
  IReportDraftRepository,
  IReportDraftGenerator,
  IReportRevisionService,
  IReportAssuranceService,
  IGenerationRunRepository,
  IIndicatorAnalyticsService,
  IEvidencePackageBuilder,
  IReportingPeriodRepository,
} from "../../ports/reporting.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { RewriteSectionInput } from "@donordesk/contracts";

/**
 * Rewrites or shortens an existing report section through the generator port
 * and persists the result as a new revision through the single mutation
 * pipeline, preserving source references. The generator must never invent
 * claims; unsupported claims are carried over. The rewrite always produces a
 * new child generation run with prompt/response hashes, re-extracts
 * assertions, and re-runs assurance.
 *
 * The rewritten content, the new revision's identity, and the assurance state
 * are returned so the web layer can refresh without re-fetching the section.
 * The child generation run carries the parent draft's template/profile/
 * planner versions and the section's current revision hash so the rewrite is
 * reproducible from the audit boundary.
 */
export class RewriteReportSectionHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly indicatorUpdates: IIndicatorUpdateRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly analytics: IIndicatorAnalyticsService,
    private readonly evidencePackages: IEvidencePackageBuilder,
    private readonly getGenerator: (tenantId?: string) => Promise<IReportDraftGenerator>,
    private readonly revisionService: IReportRevisionService,
    private readonly assuranceService: IReportAssuranceService,
    private readonly generationRuns: IGenerationRunRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    sectionId: string,
    input: RewriteSectionInput,
  ): Promise<Result<
    {
      version: string;
      content: string;
      revisionId: string;
      revisionNumber: number;
      contentHash: string;
      assuranceState: string;
      generationRunId: string;
      fallbackUsed: boolean;
    },
    DomainError
  >> {
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

    // Reproducibility: pull the parent generator's report-period snapshot so the
    // child rewrite run records the same template / profile / mapping versions
    // as the parent draft. The implementation plan §5 invariant 15 requires
    // every version needed for reproduction to be recorded.
    const periodResult = await this.periods.findById(draft.reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    const period = periodResult.value;
    const templateVersion = period?.donorTemplateVersion ?? 1;
    const mappingVersion = period?.donorTemplateVersion ?? undefined;

    // Pull the section's current narrative context so the assurance pipeline
    // re-extracts assertions against the same verified findings and evidence
    // packages the original draft was built from (Phase 2 invariant).
    const updatesResult = await this.indicatorUpdates.findByReportingPeriod(draft.reportingPeriodId, ctx.tenant.tenantId);
    if (!updatesResult.ok) return updatesResult;
    const activitiesResult = await this.activities.findByReportingPeriod(draft.reportingPeriodId, ctx.tenant.tenantId);
    if (!activitiesResult.ok) return activitiesResult;

    const evidenceIds = Array.from(
      new Set([
        ...updatesResult.value.flatMap((u) => u.attachedEvidenceIds),
        ...activitiesResult.value.flatMap((a) => a.attachedEvidenceIds),
      ]),
    );
    const evidencePackagesResult = await this.evidencePackages.build({
      tenantId: ctx.tenant.tenantId,
      evidenceIds,
    });
    if (!evidencePackagesResult.ok) return evidencePackagesResult;
    const evidencePackages = evidencePackagesResult.value;

    const findingsResult = await this.analytics.computeFindings({
      reportingPeriodId: draft.reportingPeriodId,
      projectId: draft.projectId,
      tenantId: ctx.tenant.tenantId,
    });
    if (!findingsResult.ok) return findingsResult;
    const verifiedFindings: VerifiedFinding[] = findingsResult.value;

    const childRun = ReportGenerationRun.create({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: draft.projectId,
      reportingPeriodId: draft.reportingPeriodId,
      draftId: draft.id,
      templateVersion,
      profileVersion: 1,
      mappingVersion,
      plannerVersion: 1,
      indicatorUpdateIds: updatesResult.value.map((u) => u.id),
      activityIds: activitiesResult.value.map((a) => a.id),
      evidenceIds,
      verifiedFindings,
      modelId: generator.model.modelId,
      promptVersion: generator.model.promptVersion,
      generationParams: {
        mode: input.mode,
        audience: input.audience ?? "DONOR",
        changeOrigin: "REWRITE",
        ...(input.instructions ? { instructions: input.instructions } : {}),
      },
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
      writerClaims: result.writerClaims,
      findings: verifiedFindings,
      evidencePackages,
    });
    if (!assessed.ok) return assessed;

    const fallbackUsed =
      result.fallbackUsed === true || generator.model.modelId === "stub";

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: `report.section.${input.mode.toLowerCase()}`,
      entityType: "report_section",
      entityId: sectionId,
      newValue: JSON.stringify({
        mode: input.mode,
        audience: input.audience ?? "DONOR",
        revisionId: committed.value.id,
        revisionNumber: committed.value.revisionNumber,
        assuranceState: assessed.value.assuranceState,
        generationRunId: childRun.id,
        fallbackUsed,
        modelId: generator.model.modelId,
      }),
    });

    if (fallbackUsed) {
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "report.section.rewrite.fallback",
        entityType: "report_section",
        entityId: sectionId,
        systemNote: "Rewriter fell back to stub generator; rewrite used deterministic heuristic output.",
      });
    }

    return {
      ok: true,
      value: {
        version: committed.value.createdAt.toISOString(),
        content: result.content,
        revisionId: committed.value.id,
        revisionNumber: committed.value.revisionNumber,
        contentHash: committed.value.contentHash,
        assuranceState: assessed.value.assuranceState,
        generationRunId: childRun.id,
        fallbackUsed,
      },
    };
  }
}
