import type { Result, ReportPlan, ReportPlanSection, ReportSection, ChangeOrigin } from "@donordesk/domain";
import { DomainError, attributionSectionTitle, attributionSentences, normalizeReportLanguage, placeAttribution } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type {
  IReportDraftGenerator,
  IReportRevisionService,
  IReportAssuranceService,
  IReportArtifactRepository,
  GeneratedSectionResult,
  ReportingProfileSnapshot,
} from "../ports/reporting.js";
import type { IIdGenerator, IAuditLogger } from "../ports/core.js";
import type { ILlmUsageRepository } from "../ports/billing.js";
import type { GenerationInputs } from "./report-generation-context.js";
import { deterministicBlueprintTable, financeTable, isDonorFinanceSection } from "./blueprint-tables.js";

export interface SectionDraftRequest {
  ctx: AuthenticatedContext;
  runId: string;
  plan: ReportPlan;
  inputs: GenerationInputs;
  reportingProfileSnapshot: ReportingProfileSnapshot;
  generator: IReportDraftGenerator;
  draftedSections: ReadonlyArray<{ title: string; content: string }>;
  /** Author instruction for a single-section regenerate (B7). */
  sectionInstruction?: string;
}

/**
 * Writes one report section: asks the generator for the text (recording the
 * provider call for diagnostics), and persists accepted text as a revision
 * with its typed artifacts and a fresh assurance pass. Used by full-draft
 * generation and by single-section regeneration.
 */
export class SectionGenerationService {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly llmRuns: ILlmUsageRepository,
    private readonly revisionService: IReportRevisionService,
    private readonly assuranceService: IReportAssuranceService,
    private readonly audit: IAuditLogger,
    private readonly reportArtifacts?: IReportArtifactRepository,
  ) {}

  async draft(request: SectionDraftRequest, sectionId: string, planSection: ReportPlanSection): Promise<GeneratedSectionResult> {
    const generated = await request.generator.generateSection(
      {
        reportPlan: request.plan,
        verifiedFindings: request.inputs.verifiedFindings,
        evidencePackages: request.inputs.evidencePackages,
        activities: request.inputs.activities,
        indicatorUpdates: request.inputs.indicatorUpdates,
        reportingProfileSnapshot: request.reportingProfileSnapshot,
        generationRunId: request.runId,
        reportContext: request.inputs.reportContext,
        draftedSections: [...request.draftedSections],
        ...(request.inputs.finance ? { finance: request.inputs.finance } : {}),
        ...(request.sectionInstruction ? { sectionInstruction: request.sectionInstruction } : {}),
      },
      planSection,
    );
    // The donor attribution belongs in exactly one section. The writer is told
    // which one; this enforces it for exact sentences (removed elsewhere, added
    // there if missing), whatever the model or the fallback produced.
    const ctx = request.inputs.reportContext;
    const donorName = ctx?.template?.donorName ?? ctx?.project?.donorName;
    if (donorName && generated.section.content) {
      const carrier = attributionSectionTitle(request.plan.sections);
      generated.section.content = placeAttribution(
        generated.section.content,
        attributionSentences(donorName, ctx?.project?.implementingOrganization),
        carrier === planSection.title,
        normalizeReportLanguage(request.reportingProfileSnapshot?.language) === "en",
      );
    }
    // Blueprint sections whose table comes from recorded data: append it after the
    // writer's prose (once), so the figures are exactly the recorded ones.
    const language = request.reportingProfileSnapshot?.language;
    const table =
      deterministicBlueprintTable(planSection.templateSectionId, request.inputs.activities, language, request.inputs.situation, request.inputs.finance) ??
      // A donor template's own financial narrative gets the same verified table.
      (request.inputs.finance && isDonorFinanceSection(planSection) ? financeTable(request.inputs.finance, language) : undefined);
    if (table && !generated.section.content.includes(table)) {
      generated.section.content = `${generated.section.content.trimEnd()}\n\n${table}\n`;
    }
    if (generated.telemetry) {
      const t = generated.telemetry;
      const status = generated.deterministicReason
        ? "skipped"
        : generated.usedFallback
        ? generated.fallbackReason === "PROVIDER_TIMEOUT" ? "timeout" : "error"
        : "success";
      await this.llmRuns.recordRun({
        id: this.ids.generate(),
        tenantId: request.ctx.tenant.tenantId.toString(),
        operationType: "REPORT_SECTION",
        resourceId: sectionId,
        modelId: request.generator.model.modelId,
        promptId: "report-section-drafter",
        inputTokens: t.inputTokens,
        outputTokens: t.outputTokens,
        totalTokens: t.inputTokens + t.outputTokens,
        costUsd: 0,
        latencyMs: t.latencyMs,
        status,
        promptVersion: request.generator.model.promptVersion,
        modelVersion: request.generator.model.modelVersion,
        billableUnits: 0,
        requestId: `${request.runId}:${sectionId}`,
        errorMessage: generated.fallbackReason,
        responseText: JSON.stringify({
          generationRunId: request.runId,
          sectionId,
          templateSectionId: planSection.templateSectionId,
          sectionTitle: planSection.title,
          parseOutcome: t.parseOutcome,
          qualityIssues: t.qualityIssues,
          promptHash: t.promptHash,
          responseHash: t.responseHash,
          responseChars: t.responseChars,
        }),
      });
    }
    return generated;
  }

  /**
   * Commits generated text as the section's new revision, replaces its typed
   * artifacts (best-effort) and re-runs assurance. `onCommitted` runs as soon
   * as the revision exists, before artifacts and assurance.
   */
  async persist(input: {
    ctx: AuthenticatedContext;
    runId: string;
    section: ReportSection;
    generated: GeneratedSectionResult;
    generator: IReportDraftGenerator;
    inputs: GenerationInputs;
    changeOrigin: Extract<ChangeOrigin, "GENERATION" | "REGENERATION">;
    onCommitted?: () => void;
  }): Promise<Result<{ revisionId: string; claimCount: number }, DomainError>> {
    const { ctx, generated, generator, section } = input;
    const byModel = !generated.usedFallback && !generated.deterministicReason;
    const committed = await this.revisionService.commitChange({
      tenantId: ctx.tenant.tenantId,
      section,
      content: generated.section.content,
      sourceReferences: generated.section.sourceReferences,
      unsupportedClaims: [],
      changeOrigin: input.changeOrigin,
      actorId: ctx.tenant.userId,
      modelId: byModel ? generator.model.modelId : undefined,
      promptVersion: byModel ? generator.model.promptVersion : undefined,
      generationRunId: input.runId,
    });
    if (!committed.ok) return committed;
    input.onCommitted?.();

    // AI Reporter 2 — persist typed artifacts (tables, charts, lists, Q&A,
    // deltas) when the report artifact repository is wired. Best-effort;
    // a failed persistence does not abort the section (prose is already
    // committed and assured). A regenerated section always replaces them, so
    // tables of the old text never outlive it.
    const artifacts = generated.section.artifacts ?? [];
    if (this.reportArtifacts && (artifacts.length > 0 || input.changeOrigin === "REGENERATION")) {
      const persisted = await this.reportArtifacts.replaceForSection({
        tenantId: ctx.tenant.tenantId,
        sectionId: section.id,
        revisionId: committed.value.id,
        artifacts,
      });
      if (!persisted.ok) {
        await this.audit.record({
          tenantId: ctx.tenant.tenantId,
          actorId: ctx.tenant.userId,
          eventType: "report.section.artifacts.persist_failed",
          entityType: "report_section",
          entityId: section.id,
          newValue: persisted.error.message,
        });
      }
    }

    const assessed = await this.assuranceService.assessRevision({
      ctx: { tenantId: ctx.tenant.tenantId, userId: ctx.tenant.userId },
      sectionId: section.id,
      revisionId: committed.value.id,
      writerClaims: generated.section.claims,
      findings: input.inputs.verifiedFindings,
      evidencePackages: input.inputs.evidencePackages,
    });
    if (!assessed.ok) return assessed;
    return { ok: true, value: { revisionId: committed.value.id, claimCount: assessed.value.claims.length } };
  }
}
