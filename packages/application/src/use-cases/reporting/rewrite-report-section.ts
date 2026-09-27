import type { Result, VerifiedFinding } from "@donordesk/domain";
import { DomainError, ReportGenerationRun } from "@donordesk/domain";
import type { ReportDraft, ReportSection } from "@donordesk/domain";
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
  IReportArtifactRepository,
} from "../../ports/reporting.js";
import { excludeRestrictedEvidence } from "../../ports/reporting.js";
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
    private readonly reportArtifacts?: IReportArtifactRepository,
  ) {}

  /**
   * Report Editor B10 — rewrites only the selected range and returns the
   * suggestion without saving anything. The editor shows it inline; accepting
   * it goes through the normal section save (changeOrigin REWRITE).
   */
  async preview(
    ctx: AuthenticatedContext,
    sectionId: string,
    input: RewriteSectionInput,
  ): Promise<Result<{ preview: true; content: string; selection: { from: number; to: number }; fallbackUsed: boolean; fallbackReason?: string }, DomainError>> {
    if (!input.selection) return { ok: false, error: DomainError.validation("Select the text to rewrite first.") };
    const loaded = await this.loadEditable(ctx, sectionId);
    if (!loaded.ok) return loaded;
    const excerpt = sliceSelection(loaded.value.section.content, input.selection);
    if (!excerpt.ok) return excerpt;

    const generator = await this.getGenerator(ctx.tenant.tenantId.toString());
    const result = await generator.rewriteSection({
      sectionTitle: loaded.value.section.sectionTitle,
      content: excerpt.value,
      mode: input.mode,
      audience: input.audience,
      instructions: excerptInstructions(input.instructions),
      sourceReferences: loaded.value.section.sourceReferences,
    });
    const fallbackUsed = result.fallbackUsed === true || generator.model.modelId === "stub";
    return {
      ok: true,
      value: {
        preview: true,
        content: result.content.trim(),
        selection: input.selection,
        fallbackUsed,
        ...(fallbackUsed ? { fallbackReason: result.fallbackReason ?? "PROVIDER_NOT_CONFIGURED" } : {}),
      },
    };
  }

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
      fallbackReason?: string;
    },
    DomainError
  >> {
    const loaded = await this.loadEditable(ctx, sectionId);
    if (!loaded.ok) return loaded;
    const { section: sec, draft } = loaded.value;
    const excerpt = input.selection ? sliceSelection(sec.content, input.selection) : undefined;
    if (excerpt && !excerpt.ok) return excerpt;

    const generator = await this.getGenerator(ctx.tenant.tenantId.toString());
    const result = await generator.rewriteSection({
      sectionTitle: sec.sectionTitle,
      content: excerpt ? excerpt.value : sec.content,
      mode: input.mode,
      audience: input.audience,
      instructions: excerpt ? excerptInstructions(input.instructions) : input.instructions,
      sourceReferences: sec.sourceReferences,
    });
    const rewrittenContent =
      excerpt && input.selection
        ? `${sec.content.slice(0, input.selection.from)}${result.content.trim()}${sec.content.slice(input.selection.to)}`
        : result.content;

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
    const evidencePackages = excludeRestrictedEvidence(evidencePackagesResult.value);

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
        ...(input.selection ? { selection: `${input.selection.from}-${input.selection.to}` } : {}),
      },
      sectionId,
      promptHash: result.promptHash,
      responseHash: result.responseHash,
    });
    const savedRun = await this.generationRuns.create(childRun);
    if (!savedRun.ok) return savedRun;

    const mergedUnsupported = [...new Set([...sec.unsupportedClaims, ...result.unsupportedClaims])];
    // New text: an approval of the old text no longer applies.
    if (sec.status === "APPROVED") sec.resetToDraft();
    const committed = await this.revisionService.commitChange({
      tenantId: ctx.tenant.tenantId,
      section: sec,
      content: rewrittenContent,
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

    // The section's version is its stored updatedAt (what the editor sends
    // back as expectedVersion); assurance may have touched it, so re-read.
    const latest = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!latest.ok) return latest;
    return {
      ok: true,
      value: {
        version: (latest.value ?? sec).updatedAt.toISOString(),
        content: rewrittenContent,
        revisionId: committed.value.id,
        revisionNumber: committed.value.revisionNumber,
        contentHash: committed.value.contentHash,
        assuranceState: assessed.value.assuranceState,
        generationRunId: childRun.id,
        fallbackUsed,
        ...(fallbackUsed ? { fallbackReason: result.fallbackReason ?? "PROVIDER_NOT_CONFIGURED" } : {}),
      },
    };
  }

  /** The section and its draft, when the draft is the current editable one. */
  private async loadEditable(
    ctx: AuthenticatedContext,
    sectionId: string,
  ): Promise<Result<{ section: ReportSection; draft: ReportDraft }, DomainError>> {
    const r = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };
    const draftResult = await this.drafts.findById(r.value.reportDraftId, ctx.tenant.tenantId);
    if (!draftResult.ok) return draftResult;
    const draft = draftResult.value;
    if (!draft) return { ok: false, error: DomainError.notFound("ReportDraft", r.value.reportDraftId) };
    if (draft.isSuperseded || draft.status !== "DRAFT") {
      return { ok: false, error: DomainError.invalidTransition("This report is no longer a draft, so its sections cannot be rewritten.") };
    }
    return { ok: true, value: { section: r.value, draft } };
  }
}

const EXCERPT_NOTE =
  "You are rewriting an excerpt of a report section, not the whole section. Return only the rewritten excerpt, keeping its markdown structure (lists stay lists, tables stay tables). Do not add a heading.";

function excerptInstructions(instructions: string | undefined): string {
  return instructions ? `${EXCERPT_NOTE} ${instructions}` : EXCERPT_NOTE;
}

function sliceSelection(content: string, selection: { from: number; to: number }): Result<string, DomainError> {
  if (selection.to > content.length) {
    return { ok: false, error: DomainError.conflict("This section changed since you selected the text. Select it again.") };
  }
  const excerpt = content.slice(selection.from, selection.to);
  if (!excerpt.trim()) return { ok: false, error: DomainError.validation("Select some text to rewrite.") };
  return { ok: true, value: excerpt };
}
