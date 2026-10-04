import { sectionDisplayTitle } from "@donordesk/domain";
import type { Result } from "@donordesk/domain";
import { DomainError, ReportDraft, ReportSection, ReportGenerationRun, TenantId, isSynthesisSection } from "@donordesk/domain";
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
import type { ILlmUsageRepository, IUsageCounterRepository, IPurchasedCreditPackRepository } from "../../ports/billing.js";
import type { PurchasedCreditPack } from "@donordesk/domain";
import type { EntitlementService } from "../../services/entitlement-service.js";
import { resolveEntitlementEnforcementMode } from "../../services/entitlement-service.js";
import { monthStartUtc, USAGE_METRIC_AI_CREDITS } from "../billing/_usage.js";
import type { IFinanceInputs } from "../../services/finance-inputs.js";
import { ReportGenerationContextBuilder, type GenerationInputs } from "../../services/report-generation-context.js";
import { SectionGenerationService } from "../../services/section-generation-service.js";
import { fireAndForget, type BackgroundRunner } from "../../services/background-runner.js";
import { PeriodTemplateResolver } from "../../services/period-template-resolver.js";

/** Which pool an AI-credit reservation drew from (WS-D: plan quota, then packs oldest-first). */
type CreditReservation = { source: "PLAN" } | { source: "PACK"; packId: string };

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
    /** Active top-up packs draw down after the plan's monthly AI-credit quota. */
    private readonly packs?: IPurchasedCreditPackRepository,
    /** Verified financial figures for reports (absent: reports are written without them). */
    finance?: IFinanceInputs,
  ) {
    this.context = new ReportGenerationContextBuilder(periods, projects, organizations, new PeriodTemplateResolver(templates, periods), indicatorUpdates, activities, analytics, evidencePackages, getGenerator, finance);
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
    let creditReservation: CreditReservation | null = null;
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
        // Plan quota first, then active top-up packs oldest-first (WS-D). Both
        // paths return a CreditReservation that the release call-sites below
        // undo symmetrically on any downstream failure.
        const enforcementMode = resolveEntitlementEnforcementMode();
        if (enforcementMode !== "off") {
          const reservationResult = await this.reserveAiCreditOrPack(ctx.tenant.tenantId.toString(), limit, realAiUsed);
          if (!reservationResult.ok) return reservationResult;
          if (!reservationResult.value) {
            if (enforcementMode === "report") {
              // Would have blocked: record it and let the draft generate
              // unmetered (no reservation to release later) so real demand
              // against the new caps is visible before anyone is actually cut off.
              await this.audit.record({
                tenantId: ctx.tenant.tenantId,
                actorId: ctx.tenant.userId,
                eventType: "entitlement.limit_would_block",
                entityType: "entitlement",
                entityId: ctx.tenant.tenantId.toString(),
                newValue: JSON.stringify({ resource: "AI_CREDITS", limit: String(limit), used: String(realAiUsed) }),
              });
            } else {
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
          } else {
            creditReservation = reservationResult.value;
          }
        }
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
      await this.releaseCreditReservation(ctx.tenant.tenantId.toString(), creditReservation);
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
      await this.releaseCreditReservation(ctx.tenant.tenantId.toString(), creditReservation);
      return savedRun;
    }

    // Phase 1 — create the draft structure immediately. Every plan section is
    // persisted as a NOT_STARTED placeholder so the UI can render the full
    // report skeleton (greyed out) right away. Actual narration runs section by
    // section in a background loop so each LLM call stays small and within
    // provider timeouts, and users see sections flip to ready one at a time.
    const sectionIds: string[] = [];
    const hierarchy = planHierarchy(plan.sections);
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
          ...hierarchy[i]!,
          content: "",
          sourceReferences: [],
          unsupportedClaims: [],
          status: "NOT_STARTED",
        });
        const savedSection = await this.sections.create(section);
        if (!savedSection.ok) {
          await this.releaseCreditReservation(ctx.tenant.tenantId.toString(), creditReservation);
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
          ...hierarchy[i]!,
          content: "",
          sourceReferences: [],
          unsupportedClaims: [],
          status: "DRAFTED",
        });
        const savedSection = await this.sections.create(section);
        if (!savedSection.ok) {
          await this.releaseCreditReservation(ctx.tenant.tenantId.toString(), creditReservation);
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
      await this.releaseCreditReservation(ctx.tenant.tenantId.toString(), creditReservation);
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
        creditReservation,
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

  /**
   * Reserves one AI credit: plan quota first (existing counter, race-checked
   * post-increment), then active top-up packs oldest-first. Returns `null`
   * when neither has room (caller surfaces AI_CREDITS_EXHAUSTED).
   */
  private async reserveAiCreditOrPack(tenantId: string, limit: number, realAiUsed: number): Promise<Result<CreditReservation | null, DomainError>> {
    if (realAiUsed < limit) {
      const monthStart = monthStartUtc(new Date());
      const reserved = await this.usage.add(tenantId, USAGE_METRIC_AI_CREDITS, monthStart, 1n);
      if (!reserved.ok) return reserved;
      if (reserved.value.used <= limit) {
        return { ok: true, value: { source: "PLAN" } };
      }
      // Lost a race for the last unit of plan quota: release and fall through to packs.
      await this.usage.add(tenantId, USAGE_METRIC_AI_CREDITS, monthStart, -1n);
    }
    return this.reserveFromPacks(tenantId);
  }

  private async reserveFromPacks(tenantId: string): Promise<Result<CreditReservation | null, DomainError>> {
    if (!this.packs) return { ok: true, value: null };
    const activeResult = await this.packs.listActiveByTenant(tenantId);
    if (!activeResult.ok) return activeResult;
    for (const pack of activeResult.value) {
      const wasBelow80 = pack.used / pack.credits < 0.8;
      const reserved = await this.packs.reserve(pack.id, 1);
      if (reserved.ok) {
        // §4 WS-D item 5 "auto-reminder at 80%": no notification pipeline
        // exists in this codebase (Phase 1 deviation is "console email" only,
        // and this is a Growth-only balance, not a per-user email), so this
        // is deliberately the minimal audit-based reminder called for in the
        // plan rather than a newly invented delivery mechanism — fires once,
        // the first draw-down that crosses the 80% mark for this pack.
        if (pack.source === "GROWTH_STANDING_BALANCE" && wasBelow80 && reserved.value.used / reserved.value.credits >= 0.8) {
          await this.audit.record({
            tenantId: TenantId.create(tenantId),
            actorId: "system",
            eventType: "billing.credits.standing_balance_80pct",
            entityType: "purchased_credit_pack",
            entityId: pack.id,
            newValue: JSON.stringify({ used: reserved.value.used, credits: reserved.value.credits }),
          });
        }
        return { ok: true, value: { source: "PACK", packId: pack.id } };
      }
      if (reserved.error.code !== "CONFLICT") return reserved;
      // CONFLICT: drawn down concurrently to exhaustion since listing; try the next oldest pack.
    }
    return { ok: true, value: null };
  }

  private async releaseCreditReservation(tenantId: string, reservation: CreditReservation | null): Promise<void> {
    if (!reservation) return;
    if (reservation.source === "PLAN") {
      await this.usage.add(tenantId, USAGE_METRIC_AI_CREDITS, monthStartUtc(new Date()), -1n);
    } else if (this.packs) {
      await this.packs.release(reservation.packId, 1);
    }
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
    creditReservation: CreditReservation | null;
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
    if (!realAiGenerated) {
      await this.releaseCreditReservation(input.ctx.tenant.tenantId.toString(), input.creditReservation);
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

/**
 * Report-section depth and numbering for each plan section. Levels are made
 * contiguous (first section level 1, never more than one level below the
 * previous one) because the plan can omit a template parent, e.g. a
 * guidance-only section whose children were kept.
 */
export function planHierarchy(sections: readonly ReportPlanSection[]): Array<{ level: number; numbering?: string; templateSectionId?: string }> {
  let previous = 0;
  return sections.map((s) => {
    const level = Math.max(1, Math.min(s.level ?? 1, previous + 1));
    previous = level;
    return { level, ...(s.numbering ? { numbering: s.numbering } : {}), ...(s.templateSectionId ? { templateSectionId: s.templateSectionId } : {}) };
  });
}
