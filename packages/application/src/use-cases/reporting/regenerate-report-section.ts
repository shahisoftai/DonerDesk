import type { Result, ReportPlan, ReportPlanSection, ReportSection, SectionRegenerationBlock } from "@donordesk/domain";
import {
  DomainError,
  ReportGenerationRun,
  SECTION_REGENERATION_BLOCK_MESSAGE,
  SECTION_REGENERATION_RUN_KIND,
  SECTION_REGENERATION_WINDOW_MS,
  normalizeSectionInstruction,
  sectionRegenerationBlock,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportDraftRepository,
  IReportSectionRepository,
  IReportPlanRepository,
  IGenerationRunRepository,
  ISectionRegenerationTracker,
} from "../../ports/reporting.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { ReportGenerationContextBuilder, GenerationBase, GenerationInputs } from "../../services/report-generation-context.js";
import type { SectionGenerationService } from "../../services/section-generation-service.js";
import { fireAndForget, type BackgroundRunner } from "../../services/background-runner.js";

export interface RegenerateSectionInput {
  instruction?: string;
}


function blockError(block: SectionRegenerationBlock): DomainError {
  const message = SECTION_REGENERATION_BLOCK_MESSAGE[block];
  switch (block) {
    case "GENERATION_IN_PROGRESS":
    case "SECTION_BUSY":
      return DomainError.conflict(message, { reason: block });
    case "RATE_LIMITED":
      return DomainError.policyDenied(message, { reason: block });
    default:
      return DomainError.invalidTransition(message, { reason: block });
  }
}

/**
 * The plan section a report section was written from: matched by title in the
 * latest plan, or — for a section the user added — a synthetic one built from
 * its title with generic guidance.
 */
export function planSectionFor(plan: ReportPlan | undefined, section: Pick<ReportSection, "id" | "sectionTitle">): ReportPlanSection {
  const title = section.sectionTitle.trim().toLowerCase();
  const match = plan?.sections.find((s) => s.title.trim().toLowerCase() === title);
  if (match) return match;
  return {
    templateSectionId: `custom-${section.id}`,
    title: section.sectionTitle,
    inputType: "NARRATIVE",
    required: false,
    mandatoryQuestions: [],
    evidenceNeeds: [],
  };
}

/**
 * Report Editor B7 — redraft ONE section with the same inputs and writer as a
 * full draft, plus an optional author instruction. Returns immediately (202);
 * the work runs in the background like section-wise generation, and the
 * editor polls `regeneratingSectionIds` on GET …/draft.
 *
 * The previous text is never lost: the new text is a new revision
 * (`REGENERATION`), and when the writer falls back or times out the section
 * keeps its current text and the run is recorded as failed. An approved
 * section is reopened (its approval covered the old text). Not metered;
 * rate-limited per draft.
 */
export class RegenerateReportSectionHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly plans: IReportPlanRepository,
    private readonly generationRuns: IGenerationRunRepository,
    private readonly context: ReportGenerationContextBuilder,
    private readonly sectionGeneration: SectionGenerationService,
    private readonly tracker: ISectionRegenerationTracker,
    private readonly audit: IAuditLogger,
    private readonly runInBackground: BackgroundRunner = fireAndForget,
  ) {}

  async handle(ctx: AuthenticatedContext, sectionId: string, input: RegenerateSectionInput): Promise<Result<{ sectionId: string; runId: string }, DomainError>> {
    const sectionResult = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!sectionResult.ok) return sectionResult;
    const section = sectionResult.value;
    if (!section) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };

    const draftResult = await this.drafts.findById(section.reportDraftId, ctx.tenant.tenantId);
    if (!draftResult.ok) return draftResult;
    const draft = draftResult.value;
    if (!draft) return { ok: false, error: DomainError.notFound("ReportDraft", section.reportDraftId) };

    const siblingsResult = await this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId);
    if (!siblingsResult.ok) return siblingsResult;
    const runsResult = await this.generationRuns.findByDraft(draft.id, ctx.tenant.tenantId);
    if (!runsResult.ok) return runsResult;
    const windowStart = Date.now() - SECTION_REGENERATION_WINDOW_MS;
    const recentRegenerations = runsResult.value.filter(
      (run) => run.snapshot.generationParams.kind === SECTION_REGENERATION_RUN_KIND && run.createdAt.getTime() >= windowStart,
    ).length;

    const block = sectionRegenerationBlock({
      draftStatus: draft.status,
      draftSuperseded: draft.isSuperseded,
      sectionStatuses: siblingsResult.value.map((s) => s.status),
      sectionAlreadyRegenerating: this.tracker.runningAmong([sectionId]).length > 0,
      recentRegenerations,
    });
    if (block) return { ok: false, error: blockError(block) };
    if (!this.tracker.tryStart(sectionId)) return { ok: false, error: blockError("SECTION_BUSY") };

    try {
      const baseResult = await this.context.loadBase(ctx, draft.reportingPeriodId);
      if (!baseResult.ok) return this.release(sectionId, baseResult);
      const inputsResult = await this.context.loadInputs(ctx, draft.reportingPeriodId, baseResult.value);
      if (!inputsResult.ok) return this.release(sectionId, inputsResult);
      const plansResult = await this.plans.findByReportingPeriod(draft.reportingPeriodId, ctx.tenant.tenantId);
      if (!plansResult.ok) return this.release(sectionId, plansResult);
      const plan = plansResult.value[0];
      if (!plan) return this.release(sectionId, { ok: false, error: DomainError.invariant("This report has no plan. Regenerate the whole draft instead.") });

      const base = baseResult.value;
      const inputs = inputsResult.value;
      const instruction = normalizeSectionInstruction(input.instruction);
      const run = ReportGenerationRun.create({
        id: this.ids.generate(),
        tenantId: ctx.tenant.tenantId.toString(),
        projectId: draft.projectId,
        reportingPeriodId: draft.reportingPeriodId,
        draftId: draft.id,
        templateVersion: base.templateVersion,
        profileVersion: 1,
        mappingVersion: base.period.donorTemplateVersion,
        plannerVersion: 1,
        indicatorUpdateIds: inputs.indicatorUpdateIds,
        activityIds: inputs.activityIds,
        evidenceIds: inputs.evidenceIds,
        verifiedFindings: inputs.verifiedFindings,
        modelId: base.generator.model.modelId,
        promptVersion: base.generator.model.promptVersion,
        generationParams: {
          kind: SECTION_REGENERATION_RUN_KIND,
          sectionId,
          changeOrigin: "REGENERATION",
          ...(instruction ? { instruction } : {}),
        },
        sectionId,
      });
      const savedRun = await this.generationRuns.create(run);
      if (!savedRun.ok) return this.release(sectionId, savedRun);

      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "report.section.regeneration_requested",
        entityType: "report_section",
        entityId: sectionId,
        projectId: draft.projectId,
        newValue: JSON.stringify({ runId: run.id, instruction: instruction ?? null }),
      });

      const siblings = [...siblingsResult.value].sort((a, b) => a.sectionOrder - b.sectionOrder);
      this.runInBackground(async () => {
        try {
          await this.regenerate({ ctx, sectionId, draftId: draft.id, projectId: draft.projectId, runId: run.id, plan, base, inputs, siblings, instruction });
        } catch (error) {
          await this.recordFailure(ctx, sectionId, draft.projectId, run.id, error instanceof Error ? error.message : String(error));
        } finally {
          this.tracker.finish(sectionId);
        }
      });
      return { ok: true, value: { sectionId, runId: run.id } };
    } catch (error) {
      this.tracker.finish(sectionId);
      throw error;
    }
  }

  private release<T>(sectionId: string, failure: Result<T, DomainError> & { ok: false }): Result<never, DomainError> {
    this.tracker.finish(sectionId);
    return failure;
  }

  private async regenerate(input: {
    ctx: AuthenticatedContext;
    sectionId: string;
    draftId: string;
    projectId: string;
    runId: string;
    plan: ReportPlan;
    base: GenerationBase;
    inputs: GenerationInputs;
    siblings: ReportSection[];
    instruction?: string;
  }): Promise<void> {
    const { ctx, sectionId } = input;
    const target = input.siblings.find((s) => s.id === sectionId);
    if (!target) return;
    // Every other section's current text: synthesis sections summarise the
    // real report, the rest avoid repeating their siblings.
    const draftedSections = input.siblings
      .filter((s) => s.id !== sectionId && s.content.trim().length > 0)
      .map((s) => ({ title: s.sectionTitle, content: s.content }));

    const generated = await this.sectionGeneration.draft(
      {
        ctx,
        runId: input.runId,
        plan: input.plan,
        inputs: input.inputs,
        reportingProfileSnapshot: input.base.reportingProfileSnapshot,
        generator: input.base.generator,
        draftedSections,
        sectionInstruction: input.instruction,
      },
      sectionId,
      planSectionFor(input.plan, target),
    );
    if (generated.usedFallback || generated.deterministicReason) {
      await this.recordFailure(ctx, sectionId, input.projectId, input.runId, generated.fallbackReason ?? generated.deterministicReason ?? "NO_TEXT");
      return;
    }

    // Re-read: the draft may have been regenerated or submitted meanwhile,
    // and the section's version must be the current one.
    const draftNow = await this.drafts.findById(input.draftId, ctx.tenant.tenantId);
    if (!draftNow.ok || !draftNow.value || draftNow.value.isSuperseded || draftNow.value.status !== "DRAFT") {
      await this.recordFailure(ctx, sectionId, input.projectId, input.runId, "DRAFT_NOT_EDITABLE");
      return;
    }
    const fresh = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!fresh.ok || !fresh.value) return;
    const section = fresh.value;
    const reopened = section.status === "APPROVED";
    if (reopened) section.resetToDraft();

    const persisted = await this.sectionGeneration.persist({
      ctx,
      runId: input.runId,
      section,
      generated,
      generator: input.base.generator,
      inputs: input.inputs,
      changeOrigin: "REGENERATION",
    });
    if (!persisted.ok) {
      await this.recordFailure(ctx, sectionId, input.projectId, input.runId, persisted.error.message);
      return;
    }
    if (reopened) {
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "report.section.reopened",
        entityType: "report_section",
        entityId: sectionId,
        projectId: input.projectId,
        newValue: JSON.stringify({ reason: "regenerated" }),
      });
    }
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.section.regenerated",
      entityType: "report_section",
      entityId: sectionId,
      projectId: input.projectId,
      newValue: JSON.stringify({ runId: input.runId, revisionId: persisted.value.revisionId, claims: persisted.value.claimCount }),
    });
  }

  private async recordFailure(ctx: AuthenticatedContext, sectionId: string, projectId: string, runId: string, reason: string): Promise<void> {
    await this.audit
      .record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "report.section.regeneration_failed",
        entityType: "report_section",
        entityId: sectionId,
        projectId,
        newValue: JSON.stringify({ runId, reason }),
        systemNote: "The section kept its previous text.",
      })
      .catch(() => undefined);
  }
}
