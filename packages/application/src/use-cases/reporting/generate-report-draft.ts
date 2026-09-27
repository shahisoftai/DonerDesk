import { sectionDisplayTitle } from "@donordesk/domain";
import type { Result } from "@donordesk/domain";
import { DomainError, ReportDraft, ReportSection, ReportGenerationRun, isSynthesisSection } from "@donordesk/domain";
import type { ReportPlan, ReportPlanSection, ReportingPeriod, ReportingRequirement } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportingPeriodRepository,
  IReportDraftRepository,
  IReportSectionRepository,
  IReportDraftGenerator,
  IReportPlanner,
  IRequirementResolver,
  IIndicatorAnalyticsService,
  IGenerationRunRepository,
  IReportPlanRepository,
  IEvidencePackageBuilder,
  IReportRevisionService,
  IReportAssuranceService,
  IReportArtifactRepository,
  ReportingProfileSnapshot,
} from "../../ports/reporting.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { ILlmUsageRepository, IUsageCounterRepository } from "../../ports/billing.js";
import type { EntitlementService } from "../../services/entitlement-service.js";
import { monthStartUtc, USAGE_METRIC_AI_CREDITS } from "../billing/_usage.js";
import { ReportGenerationContextBuilder, type GenerationInputs } from "../../services/report-generation-context.js";
import { SectionGenerationService } from "../../services/section-generation-service.js";
import { fireAndForget, type BackgroundRunner } from "../../services/background-runner.js";
import { PeriodTemplateResolver } from "../../services/period-template-resolver.js";

/**
 * Orchestrates the full generation pipeline: plan -> deterministic analysis ->
 * immutable generation snapshot -> drafting -> revision commit -> assertion
 * extraction and verification -> claim and plan persistence. The LLM (or stub)
 * only narrates verified findings; every material assertion in the final
 * content is extracted and verified deterministically before it is persisted,
 * bound to its exact revision and content hash.
 */
export class GenerateReportDraftHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly periods: IReportingPeriodRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    projects: IProjectRepository,
    organizations: IOrganizationRepository,
    templates: IDonorTemplateRepository,
    indicatorUpdates: IIndicatorUpdateRepository,
    activities: IActivityUpdateRepository,
    private readonly planner: IReportPlanner,
    private readonly requirementResolver: IRequirementResolver,
    analytics: IIndicatorAnalyticsService,
    evidencePackages: IEvidencePackageBuilder,
    private readonly generationRuns: IGenerationRunRepository,
    private readonly reportPlans: IReportPlanRepository,
    revisionService: IReportRevisionService,
    assuranceService: IReportAssuranceService,
    getGenerator: (tenantId?: string) => Promise<IReportDraftGenerator>,
    private readonly audit: IAuditLogger,
    private readonly entitlements: EntitlementService,
    private readonly usage: IUsageCounterRepository,
    private readonly llmRuns: ILlmUsageRepository,
    reportArtifacts?: IReportArtifactRepository,
    /** Runs the section-wise loop after the response (injectable so the api can await it). */
    private readonly runInBackground: BackgroundRunner = fireAndForget,
  ) {
    this.context = new ReportGenerationContextBuilder(periods, projects, organizations, new PeriodTemplateResolver(templates, periods), indicatorUpdates, activities, analytics, evidencePackages, getGenerator);
    this.sectionGeneration = new SectionGenerationService(ids, llmRuns, revisionService, assuranceService, audit, reportArtifacts);
  }

  private readonly context: ReportGenerationContextBuilder;
  private readonly sectionGeneration: SectionGenerationService;

  async handle(
    ctx: AuthenticatedContext,
    reportingPeriodId: string,
  ): Promise<
    Result<
      {
        draftId: string;
        sectionIds: string[];
        generating: boolean;
        totalSections: number;
        fallbackUsed: boolean;
        fallbackReason?: string;
        generatorId?: string;
        generatorModelVersion?: string;
        generatorPromptVersion?: number;
      },
      DomainError
    >
  > {
    const baseResult = await this.context.loadBase(ctx, reportingPeriodId, "latest");
    if (!baseResult.ok) return baseResult;
    const base = baseResult.value;
    const { period, project, aiEnabled, generator, chargeAiCredits, meterPlatformCredits, templateSections, templateVersion, reportingProfileSnapshot } = base;

    // P0-4 donor template gate: a donor report must have a defined section
    // structure (a donor template with sections, or an explicit approved
    // structure). Without it we must not silently fabricate a single generic
    // section or create a draft/credit. Block before any side effects.
    if (templateSections.length === 0) {
      return {
        ok: false,
        error: DomainError.reportGateBlocked(
          "Attach a donor template before generating. The report structure is defined by the donor template; a report cannot be generated without one.",
        ),
      };
    }

    const requirementSnapshot = await this.resolveRequirementSnapshot(ctx, reportingPeriodId);
    const planResult = await this.planner.plan({
      reportingPeriodId,
      projectId: period.projectId,
      tenantId: ctx.tenant.tenantId,
      templateSections,
      templateVersion,
      profileVersion: 1,
      reportingProfileSnapshot,
      requirements: requirementSnapshot,
    });
    if (!planResult.ok) return planResult;
    const plan = planResult.value;

    const inputsResult = await this.context.loadInputs(ctx, reportingPeriodId, base);
    if (!inputsResult.ok) return inputsResult;
    const inputs = inputsResult.value;
    const { verifiedFindings, evidenceIds } = inputs;

    // AI credit enforcement: one customer credit = one successfully persisted
    // real (non-stub) AI draft. Stub heuristic generation and manual reports
    // are never metered. The counter is reconciled against the AI usage ledger
    // before enforcement so a previously polluted counter (e.g. from the era
    // when stub generation was metered) cannot lock tenants out. A failed
    // generation releases the reserved credit; a successful persisted draft
    // consumes it.
    let creditReserved = false;
    if (meterPlatformCredits) {
      const entitlementResult = await this.entitlements.resolve({ tenantId: ctx.tenant.tenantId.toString() });
      if (!entitlementResult.ok) return entitlementResult;
      const limit = entitlementResult.value.limits.monthlyAiDraftCredits;
      if (limit !== null) {
        const now = new Date();
        const monthStart = monthStartUtc(now);
        // Ledger is the source of truth: real AI drafts persisted this month.
        const aiRunsResult = await this.llmRuns.countAiReportDrafts(ctx.tenant.tenantId.toString(), monthStart);
        if (!aiRunsResult.ok) return aiRunsResult;
        const realAiUsed = aiRunsResult.value;
        // Self-heal a polluted counter so it never exceeds real AI usage.
        const counter = await this.usage.get(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStart);
        if (!counter.ok) return counter;
        if (Number(counter.value.used) > realAiUsed) {
          const healed = await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStart, BigInt(realAiUsed) - counter.value.used);
          if (!healed.ok) return healed;
        }
        if (realAiUsed >= limit) {
          return {
            ok: false,
            error: DomainError.aiCreditsExhausted("AI draft credits exhausted for the current billing month.", {
              resource: "AI_CREDITS",
              limit: String(limit),
              usage: String(realAiUsed),
              upgradePath: "/settings/billing",
            }),
          };
        }
        const reserved = await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStart, 1n);
        if (!reserved.ok) return reserved;
        if (reserved.value.used > limit) {
          await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStart, -1n);
          return {
            ok: false,
            error: DomainError.aiCreditsExhausted("AI draft credits exhausted for the current billing month.", {
              resource: "AI_CREDITS",
              limit: String(limit),
              usage: String(reserved.value.used),
              upgradePath: "/settings/billing",
            }),
          };
        }
        creditReserved = true;
      }
    }

    // Supersede any earlier working drafts for this period so there is always
    // exactly one current draft. Approved, exported, and submitted drafts are
    // preserved as the historical record.
    const priorDraftsResult = await this.drafts.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!priorDraftsResult.ok) return priorDraftsResult;
    const supersedeAt = new Date();
    for (const prior of priorDraftsResult.value) {
      if (prior.isSuperseded) continue;
      if (prior.status === "DRAFT" || prior.status === "UNDER_REVIEW") {
        prior.supersede(supersedeAt);
        const updated = await this.drafts.update(prior);
        if (!updated.ok) return updated;
      }
    }

    const draftId = this.ids.generate();
    const draft = ReportDraft.create({
      id: draftId,
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: period.projectId,
      reportingPeriodId,
      title: `${project.title} — ${period.reportType.toLowerCase()} report`,
      generatedByAi: chargeAiCredits,
      createdById: ctx.tenant.userId,
    });
    const savedDraft = await this.drafts.create(draft);
    if (!savedDraft.ok) {
      if (creditReserved) await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStartUtc(new Date()), -1n);
      return savedDraft;
    }

    // Immutable generation snapshot: persisted at run start, never mutated.
    const run = ReportGenerationRun.create({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: period.projectId,
      reportingPeriodId,
      draftId,
      templateVersion,
      profileVersion: 1,
      mappingVersion: period.donorTemplateVersion,
      plannerVersion: 1,
      indicatorUpdateIds: inputs.indicatorUpdateIds,
      activityIds: inputs.activityIds,
      evidenceIds,
      verifiedFindings,
      modelId: chargeAiCredits ? generator.model.modelId : "none",
      promptVersion: chargeAiCredits ? generator.model.promptVersion : 1,
      generationParams: { generatedByAi: String(chargeAiCredits), reportType: period.reportType },
    });
    const savedRun = await this.generationRuns.create(run);
    if (!savedRun.ok) {
      if (creditReserved) await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStartUtc(new Date()), -1n);
      return savedRun;
    }

    // Phase 1 — create the draft structure immediately. Every plan section is
    // persisted as a NOT_STARTED placeholder so the UI can render the full
    // report skeleton (greyed out) right away. Actual narration runs section by
    // section in a background loop so each LLM call stays small and within
    // provider timeouts, and users see sections flip to ready one at a time.
    const sectionIds: string[] = [];
    if (aiEnabled) {
      for (let i = 0; i < plan.sections.length; i++) {
        const sectionId = this.ids.generate();
        sectionIds.push(sectionId);
        const section = ReportSection.create({
          id: sectionId,
          tenantId: ctx.tenant.tenantId.toString(),
          reportDraftId: draftId,
          sectionTitle: sectionDisplayTitle(plan.sections[i]!),
          sectionOrder: i,
          content: "",
          sourceReferences: [],
          unsupportedClaims: [],
          status: "NOT_STARTED",
        });
        const savedSection = await this.sections.create(section);
        if (!savedSection.ok) {
          if (creditReserved) {
            await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStartUtc(new Date()), -1n);
          }
          return savedSection;
        }
      }
    } else {
      // AI disabled for the organization: emit empty manual sections so the
      // report structure is still created, matching the pre-AI manual flow.
      for (let i = 0; i < plan.sections.length; i++) {
        const sectionId = this.ids.generate();
        sectionIds.push(sectionId);
        const section = ReportSection.create({
          id: sectionId,
          tenantId: ctx.tenant.tenantId.toString(),
          reportDraftId: draftId,
          sectionTitle: sectionDisplayTitle(plan.sections[i]!),
          sectionOrder: i,
          content: "",
          sourceReferences: [],
          unsupportedClaims: [],
          status: "DRAFTED",
        });
        const savedSection = await this.sections.create(section);
        if (!savedSection.ok) {
          if (creditReserved) {
            await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStartUtc(new Date()), -1n);
          }
          return savedSection;
        }
      }
    }

    // ReportPlan is unique on (tenantId, reportingPeriodId, version);
    // createNextVersion allocates the next free version atomically, so
    // concurrent regenerations cannot collide on the same version.
    const savedPlan = this.reportPlans.createNextVersion
      ? await this.reportPlans.createNextVersion(plan)
      : await this.reportPlans.create(plan);
    if (!savedPlan.ok) {
      if (creditReserved) {
        await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStartUtc(new Date()), -1n);
      }
      return savedPlan;
    }

    // Phase 2 — background section-wise narration. Fire-and-forget: the HTTP
    // response returns immediately (structure visible), and the loop drafts
    // one section per LLM call, committing + assessing each as it completes.
    // The UI polls GET /draft and observes sections flip NOT_STARTED -> DRAFTED.
    if (aiEnabled) {
      this.runInBackground(() => this.generateSectionsInBackground({
        ctx,
        reportingPeriodId,
        draftId,
        draft,
        runId: run.id,
        plan,
        sectionIds,
        period,
        inputs,
        reportingProfileSnapshot,
        generator,
        chargeAiCredits,
        creditReserved,
      }).catch(async (error) => {
        await this.audit.record({
          tenantId: ctx.tenant.tenantId,
          actorId: ctx.tenant.userId,
          eventType: "report.draft.generation_error",
          entityType: "report_draft",
          entityId: draftId,
          projectId: period.projectId,
          systemNote: `Background section-wise generation failed: ${error instanceof Error ? error.message : String(error)}`,
        }).catch(() => undefined);
      }));
    } else {
      // AI disabled: no background work; the manual skeleton is the result.
      period.transitionTo(period.status);
      period.setDonorTemplate(period.donorTemplateId ?? "");
      await this.periods.update(period);
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "report.draft.generated",
        entityType: "report_draft",
        entityId: draftId,
        projectId: period.projectId,
        newValue: `sections=${sectionIds.length};claims=0;generatedByAi=false;fallback=true;reason=PROVIDER_NOT_CONFIGURED;run=${run.id}`,
      });
    }

    return {
      ok: true,
      value: {
        draftId,
        sectionIds,
        generating: aiEnabled,
        totalSections: sectionIds.length,
        fallbackUsed: !aiEnabled,
        fallbackReason: !aiEnabled ? ("PROVIDER_NOT_CONFIGURED" as const) : undefined,
        generatorId: generator.model.modelId,
        generatorModelVersion: generator.model.modelVersion,
        generatorPromptVersion: generator.model.promptVersion,
      },
    };
  }

  private async generateSectionsInBackground(input: {
    ctx: AuthenticatedContext;
    reportingPeriodId: string;
    draftId: string;
    draft: ReportDraft;
    runId: string;
    plan: ReportPlan;
    sectionIds: string[];
    period: ReportingPeriod;
    inputs: GenerationInputs;
    reportingProfileSnapshot: ReportingProfileSnapshot;
    generator: IReportDraftGenerator;
    chargeAiCredits: boolean;
    creditReserved: boolean;
  }): Promise<void> {
    const startedAt = Date.now();
    // Sections previously ran one at a time in this loop, so a ~9-section
    // donor template took 9x a single section's LLM latency end to end.
    // Bounded concurrency lets several sections draft in parallel while
    // still capping how many simultaneous LLM/DB calls one draft can incur.
    const CONCURRENCY = Math.max(1, Number(process.env.AI_REPORTER_SECTION_CONCURRENCY ?? "3") || 3);
    const state = {
      usedFallback: false,
      fallbackReason: undefined as string | undefined,
      generationFailed: false,
      claimCount: 0,
      deterministicGapSections: 0,
      stopped: false,
      drafted: [] as Array<{ title: string; content: string }>,
    };

    // Synthesis sections (executive summary, conclusion) summarise the
    // report, so they are drafted only after every other section exists and
    // receive those drafts as input. Previously the summary was drafted first
    // (plan order) and could contradict or omit the sections it introduces.
    const indexes = input.sectionIds.map((_, i) => i);
    const isSynthesis = (i: number) => isSynthesisSection(input.plan.sections[i]!);
    const phases = [indexes.filter((i) => !isSynthesis(i)), indexes.filter(isSynthesis)];

    try {
      for (const phase of phases) {
        let next = 0;
        const runWorker = async (): Promise<void> => {
          for (;;) {
            if (state.stopped) return;
            const i = phase[next++];
            if (i === undefined) return;
            const shouldStop = await this.generateOneSection(input, input.sectionIds[i]!, input.plan.sections[i]!, state);
            if (shouldStop) {
              state.stopped = true;
              return;
            }
          }
        };
        const workerCount = Math.min(CONCURRENCY, phase.length);
        await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
        if (state.stopped) break;
      }
    } catch (error) {
      state.generationFailed = true;
      this.audit.record({
        tenantId: input.ctx.tenant.tenantId,
        actorId: input.ctx.tenant.userId,
        eventType: "report.draft.generation_error",
        entityType: "report_draft",
        entityId: input.draftId,
        projectId: input.draft.projectId,
        systemNote: `Section-wise generation loop threw: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => undefined);
    }

    const { usedFallback, fallbackReason, generationFailed, claimCount, deterministicGapSections } = state;

    // A real AI draft is one the configured provider actually produced. When
    // any section fell back to the stub (or the loop errored), the draft is
    // not AI-generated: it must not be metered, must not be billed, and the
    // reserved credit must be released.
    const realAiGenerated = input.chargeAiCredits && !usedFallback && !generationFailed;
    if (input.creditReserved && !realAiGenerated) {
      await this.usage.add(input.ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStartUtc(new Date()), -1n);
    }

    if (input.chargeAiCredits) {
      // P0-2 — `generatedByAi` must reflect the actual outcome, not an
      // optimistic flag. Whenever the configured provider did not produce the
      // persisted text (any fallback, or a loop error), the draft must not be
      // presented as AI-generated. This correction is NOT gated on a clean
      // completion: a partially-failed generation is also not AI.
      if (realAiGenerated) {
        await this.recordLlmRun(input.ctx, input.reportingPeriodId, true, "success", 0, 0, 0, 0, Date.now() - startedAt, input.generator.model.modelId, input.generator.model.modelVersion, input.generator.model.promptVersion, input.generator.providerSource !== "TENANT");
      } else {
        await this.recordLlmRun(input.ctx, input.reportingPeriodId, true, "error", 0, 0, 0, 0, Date.now() - startedAt, input.generator.model.modelId, input.generator.model.modelVersion, input.generator.model.promptVersion);
        input.draft.setGeneratedByAi(false);
        const correctedDraft = await this.drafts.update(input.draft);
        if (!correctedDraft.ok) return;
      }
    }

    await this.audit.record({
      tenantId: input.ctx.tenant.tenantId,
      actorId: input.ctx.tenant.userId,
      eventType: "report.draft.generated",
      entityType: "report_draft",
      entityId: input.draftId,
      projectId: input.draft.projectId,
      newValue: `sections=${input.sectionIds.length};claims=${claimCount};generatedByAi=${realAiGenerated};fallback=${usedFallback || generationFailed};reason=${fallbackReason ?? "none"};insufficientInputSections=${deterministicGapSections};run=${input.runId}`,
    });

    if (usedFallback) {
      await this.audit.record({
        tenantId: input.ctx.tenant.tenantId,
        actorId: input.ctx.tenant.userId,
        eventType: "report.draft.fallback",
        entityType: "report_draft",
        entityId: input.draftId,
        systemNote: `Draft generation fell back to stub generator (reason=${fallbackReason ?? "unknown"}).`,
      });
    }

    input.period.transitionTo(input.period.status);
    input.period.setDonorTemplate(input.period.donorTemplateId ?? "");
    await this.periods.update(input.period);
  }

  /**
   * Draft, persist, and assure a single section. Extracted so
   * `generateSectionsInBackground` can run several of these concurrently
   * instead of one at a time. Returns `true` when the caller should stop
   * scheduling further sections (cancellation or a hard failure).
   */
  private async generateOneSection(
    input: {
      ctx: AuthenticatedContext;
      draftId: string;
      draft: ReportDraft;
      runId: string;
      plan: ReportPlan;
      inputs: GenerationInputs;
      reportingProfileSnapshot: ReportingProfileSnapshot;
      generator: IReportDraftGenerator;
    },
    sectionId: string,
    planSection: ReportPlanSection,
    state: {
      usedFallback: boolean;
      fallbackReason: string | undefined;
      generationFailed: boolean;
      claimCount: number;
      deterministicGapSections: number;
      stopped: boolean;
      /** Sections of this draft written so far (shared across concurrent workers). */
      drafted: Array<{ title: string; content: string }>;
    },
  ): Promise<boolean> {
    // Honor cancellation: the draft is superseded by a regeneration or by
    // the user's "Stop" action. Stop drafting further sections.
    const freshDraft = await this.drafts.findById(input.draftId, input.ctx.tenant.tenantId);
    if (!freshDraft.ok || !freshDraft.value) return true;
    if (freshDraft.value.isSuperseded) {
      this.audit.record({
        tenantId: input.ctx.tenant.tenantId,
        actorId: input.ctx.tenant.userId,
        eventType: "report.draft.generation_stopped",
        entityType: "report_draft",
        entityId: input.draftId,
        projectId: input.draft.projectId,
        systemNote: "Section-wise generation stopped because the draft was superseded (regenerated or cancelled).",
      }).catch(() => undefined);
      return true;
    }

    // Resume-safe: skip sections already drafted by a previous run.
    const existing = await this.sections.findById(sectionId, input.ctx.tenant.tenantId);
    if (!existing.ok || !existing.value) return false;
    const section = existing.value;
    if (section.status === "DRAFTED" || section.content.trim().length > 0) {
      state.drafted.push({ title: planSection.title, content: section.content });
      return false;
    }

    const generated = await this.sectionGeneration.draft(
      {
        ctx: input.ctx,
        runId: input.runId,
        plan: input.plan,
        inputs: input.inputs,
        reportingProfileSnapshot: input.reportingProfileSnapshot,
        generator: input.generator,
        draftedSections: state.drafted,
      },
      sectionId,
      planSection,
    );
    if (generated.usedFallback) {
      state.usedFallback = true;
      state.fallbackReason = generated.fallbackReason ?? state.fallbackReason;
    }
    if (generated.deterministicReason) state.deterministicGapSections += 1;

    const persisted = await this.sectionGeneration.persist({
      ctx: input.ctx,
      runId: input.runId,
      section,
      generated,
      generator: input.generator,
      inputs: input.inputs,
      changeOrigin: "GENERATION",
      onCommitted: () => state.drafted.push({ title: planSection.title, content: generated.section.content }),
    });
    if (!persisted.ok) {
      state.generationFailed = true;
      return true;
    }
    state.claimCount += persisted.value.claimCount;
    return false;
  }

  /**
   * Quality remediation WS1: resolve the effective requirement snapshot so the
   * plan carries donor requirement guidance, mandatory questions, and exact
   * coverage keys. Best-effort by design — a resolver failure must never block
   * drafting, because the REQUIREMENT_UNSATISFIED gate evaluates the same
   * snapshot family separately at assurance time.
   */
  private async resolveRequirementSnapshot(
    ctx: AuthenticatedContext,
    reportingPeriodId: string,
  ): Promise<ReportingRequirement[]> {
    try {
      const resolved = await this.requirementResolver.resolve({
        tenantId: ctx.tenant.tenantId,
        reportingPeriodId,
        effectiveDate: new Date(),
      });
      return resolved.ok ? resolved.value.snapshot : [];
    } catch {
      return [];
    }
  }

  private async recordLlmRun(
    ctx: AuthenticatedContext,
    reportingPeriodId: string,
    generatedByAi: boolean,
    status: string,
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
    costUsd: number,
    latencyMs: number,
    modelId: string,
    modelVersion: string,
    promptVersion: number,
    billable = true,
  ): Promise<void> {
    if (!generatedByAi) return;
    await this.llmRuns.recordRun({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      operationType: "REPORT_DRAFT",
      resourceId: reportingPeriodId,
      modelId,
      promptId: "report-drafter",
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd,
      latencyMs,
      status,
      promptVersion,
      modelVersion,
      // Only DonorDesk-provider drafts are billable; a tenant's own provider
      // records 0 so it never counts toward the AI-credit ledger.
      billableUnits: billable && status === "success" ? 1 : 0,
      requestId: `${reportingPeriodId}:${Date.now()}`,
    });
  }
}
