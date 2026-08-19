import type { Result } from "@donordesk/domain";
import { DomainError, ReportDraft, ReportSection, ReportGenerationRun } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportingPeriodRepository,
  IReportDraftRepository,
  IReportSectionRepository,
  IReportDraftGenerator,
  IReportPlanner,
  IIndicatorAnalyticsService,
  IGenerationRunRepository,
  IReportPlanRepository,
  IEvidencePackageBuilder,
  IReportRevisionService,
  IReportAssuranceService,
  ReportingProfileSnapshot,
  ReportGenerationContext,
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

function parseProfileSnapshot(json: string): ReportingProfileSnapshot {
  if (!json || json === "{}") {
    return { tone: "FORMAL", language: "en", formattingRules: [], sectionOverrides: {} };
  }
  try {
    const raw = JSON.parse(json) as {
      tone?: string;
      language?: string;
      formattingRules?: string[];
      sectionOverrides?: Record<string, { min?: number; max?: number }>;
    };
    const tone = raw.tone as ReportingProfileSnapshot["tone"];
    return {
      tone: tone === "FORMAL" || tone === "CONCISE" || tone === "NARRATIVE" || tone === "TECHNICAL" ? tone : "FORMAL",
      language: raw.language ?? "en",
      formattingRules: Array.isArray(raw.formattingRules) ? raw.formattingRules : [],
      sectionOverrides: raw.sectionOverrides ?? {},
    };
  } catch {
    return { tone: "FORMAL", language: "en", formattingRules: [], sectionOverrides: {} };
  }
}

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
    private readonly projects: IProjectRepository,
    private readonly organizations: IOrganizationRepository,
    private readonly templates: IDonorTemplateRepository,
    private readonly indicatorUpdates: IIndicatorUpdateRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly planner: IReportPlanner,
    private readonly analytics: IIndicatorAnalyticsService,
    private readonly evidencePackages: IEvidencePackageBuilder,
    private readonly generationRuns: IGenerationRunRepository,
    private readonly reportPlans: IReportPlanRepository,
    private readonly revisionService: IReportRevisionService,
    private readonly assuranceService: IReportAssuranceService,
    private readonly getGenerator: (tenantId?: string) => Promise<IReportDraftGenerator>,
    private readonly audit: IAuditLogger,
    private readonly entitlements: EntitlementService,
    private readonly usage: IUsageCounterRepository,
    private readonly llmRuns: ILlmUsageRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<{ draftId: string; sectionIds: string[]; claimCount: number; planId: string; generationRunId: string }, DomainError>> {
    const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    if (!periodResult.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", reportingPeriodId) };
    const period = periodResult.value;

    const projectResult = await this.projects.findById(period.projectId, ctx.tenant.tenantId);
    if (!projectResult.ok) return projectResult;
    if (!projectResult.value) return { ok: false, error: DomainError.notFound("Project", period.projectId) };
    const project = projectResult.value;
    const organizationResult = await this.organizations.findByTenant(ctx.tenant.tenantId);
    if (!organizationResult.ok) return organizationResult;
    if (!organizationResult.value) return { ok: false, error: DomainError.notFound("Organization", ctx.tenant.tenantId.toString()) };
    const aiEnabled = organizationResult.value.aiEnabled;

    const generator = await this.getGenerator(ctx.tenant.tenantId.toString());
    // Only a real (non-stub) provider counts as AI for credit metering. Stub
    // heuristic generation and manual reports are never metered.
    const aiProviderAvailable = generator.model.modelId !== "stub";
    const chargeAiCredits = aiEnabled && aiProviderAvailable;

    const template = period.donorTemplateId
      ? await this.templates.findById(period.donorTemplateId, ctx.tenant.tenantId)
      : undefined;
    const templateSections = template?.ok && template.value ? template.value.sections : [];
    const templateVersion = template?.ok && template.value ? template.value.version : 1;

    const reportingProfileSnapshot = parseProfileSnapshot(period.reportingProfileSnapshotJson);

    const planResult = await this.planner.plan({
      reportingPeriodId,
      projectId: period.projectId,
      tenantId: ctx.tenant.tenantId,
      templateSections,
      templateVersion,
      profileVersion: 1,
      reportingProfileSnapshot,
    });
    if (!planResult.ok) return planResult;
    const plan = planResult.value;

    const findingsResult = await this.analytics.computeFindings({
      reportingPeriodId,
      projectId: period.projectId,
      tenantId: ctx.tenant.tenantId,
    });
    if (!findingsResult.ok) return findingsResult;
    const verifiedFindings = findingsResult.value;

    const updatesResult = await this.indicatorUpdates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!updatesResult.ok) return updatesResult;
    const activitiesResult = await this.activities.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!activitiesResult.ok) return activitiesResult;

    const evidenceIds = Array.from(new Set([
      ...updatesResult.value.flatMap((u) => u.attachedEvidenceIds),
      ...activitiesResult.value.flatMap((a) => a.attachedEvidenceIds),
    ]));
    const evidencePackagesResult = await this.evidencePackages.build({ tenantId: ctx.tenant.tenantId, evidenceIds });
    if (!evidencePackagesResult.ok) return evidencePackagesResult;
    const evidencePackages = evidencePackagesResult.value;

    // Narrative context: activity records and indicator updates are snapshotted
    // into the generation input so the narrator can cite them directly, not
    // just harvest their attached evidence IDs.
    const indicatorCodeById = new Map(verifiedFindings.map((f) => [f.indicatorId, f.indicatorCode]));
    const indicatorUpdates = updatesResult.value.map((u) => ({
      indicatorId: u.indicatorId,
      indicatorCode: indicatorCodeById.get(u.indicatorId) ?? u.indicatorId,
      periodAchievement: u.periodAchievement,
      cumulativeAchievement: u.cumulativeAchievement,
      comments: u.comments,
      dataSource: u.dataSource,
      attachedEvidenceIds: u.attachedEvidenceIds,
      verificationStatus: u.verificationStatus,
    }));
    const activities = activitiesResult.value.map((a) => ({
      activityId: a.id,
      activityTitle: a.activityTitle,
      activityDate: a.activityDate,
      location: a.location,
      participantsTotal: a.participantsTotal,
      participantsMale: a.participantsMale,
      participantsFemale: a.participantsFemale,
      participantsChildren: a.participantsChildren,
      participantsDisability: a.participantsDisability,
      summary: a.summary,
      achievements: a.achievements,
      challenges: a.challenges,
      lessonsLearned: a.lessonsLearned,
      nextSteps: a.nextSteps,
      attachedEvidenceIds: a.attachedEvidenceIds,
      status: a.status,
    }));

    // AI credit enforcement: one customer credit = one successfully persisted
    // real (non-stub) AI draft. Stub heuristic generation and manual reports
    // are never metered. The counter is reconciled against the AI usage ledger
    // before enforcement so a previously polluted counter (e.g. from the era
    // when stub generation was metered) cannot lock tenants out. A failed
    // generation releases the reserved credit; a successful persisted draft
    // consumes it.
    let creditReserved = false;
    if (chargeAiCredits) {
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
      indicatorUpdateIds: updatesResult.value.map((u) => u.id),
      activityIds: activitiesResult.value.map((a) => a.id),
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

    const startedAt = Date.now();
    let generated;
    let usedFallback = true;
    let generationFailed = false;
    try {
      const result = aiEnabled
        ? await generator.generateDraft({
            reportPlan: plan,
            verifiedFindings,
            evidencePackages,
            activities,
            indicatorUpdates,
            reportingProfileSnapshot,
            generationRunId: run.id,
            reportContext: this.buildReportContext(project, period, template?.ok && template.value ? template.value : undefined),
          })
        : { sections: this.buildManualSections(plan.sections), usedFallback: true };
      generated = result.sections;
      usedFallback = result.usedFallback;
    } catch (error) {
      generationFailed = true;
      if (creditReserved) {
        await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStartUtc(new Date()), -1n);
      }
      await this.recordLlmRun(ctx, reportingPeriodId, chargeAiCredits, "error", 0, 0, 0, 0, Date.now() - startedAt, generator.model.modelId, generator.model.modelVersion, generator.model.promptVersion);
      return { ok: false, error: DomainError.invariant("Report draft generation failed") };
    }

    // A real AI draft is one the configured provider actually produced. When
    // the provider failed and the generator fell back to the stub, the draft
    // is not AI-generated: it must not be metered, must not be billed, and the
    // reserved credit must be released.
    const realAiGenerated = chargeAiCredits && !usedFallback;
    if (creditReserved && !realAiGenerated) {
      await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStartUtc(new Date()), -1n);
      creditReserved = false;
    }

    const sectionIds: string[] = [];
    let claimCount = 0;

    for (let i = 0; i < generated.length; i++) {
      const g = generated[i]!;
      const sectionId = this.ids.generate();
      sectionIds.push(sectionId);
      const section = ReportSection.create({
        id: sectionId,
        tenantId: ctx.tenant.tenantId.toString(),
        reportDraftId: draftId,
        sectionTitle: g.title,
        sectionOrder: i,
        content: "",
        sourceReferences: g.sourceReferences,
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

      // Every content mutation goes through the revision pipeline: a new
      // UNASSESSED revision is created and the section repoints at it.
      const committed = await this.revisionService.commitChange({
        tenantId: ctx.tenant.tenantId,
        section,
        content: g.content,
        sourceReferences: g.sourceReferences,
        unsupportedClaims: [],
        changeOrigin: "GENERATION",
        actorId: ctx.tenant.userId,
        modelId: realAiGenerated ? generator.model.modelId : undefined,
        promptVersion: realAiGenerated ? generator.model.promptVersion : undefined,
        generationRunId: run.id,
      });
      if (!committed.ok) {
        if (creditReserved) {
          await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStartUtc(new Date()), -1n);
        }
        return committed;
      }

      // Extract assertions from the final content, reconcile the writer's
      // claims, verify every material assertion, and set revision assurance.
      const assessed = await this.assuranceService.assessRevision({
        ctx: { tenantId: ctx.tenant.tenantId, userId: ctx.tenant.userId },
        sectionId,
        revisionId: committed.value.id,
        writerClaims: g.claims,
        findings: verifiedFindings,
        evidencePackages,
      });
      if (!assessed.ok) {
        if (creditReserved) {
          await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStartUtc(new Date()), -1n);
        }
        return assessed;
      }
      claimCount += assessed.value.claims.length;
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

    // Record the run and correct the draft's AI flag. A stub fallback is a
    // failed AI attempt: it is recorded as an error run (never billed) and the
    // draft is marked as not AI-generated so no credit is consumed.
    if (chargeAiCredits && !generationFailed) {
      if (realAiGenerated) {
        await this.recordLlmRun(ctx, reportingPeriodId, true, "success", 0, 0, 0, 0, Date.now() - startedAt, generator.model.modelId, generator.model.modelVersion, generator.model.promptVersion);
      } else {
        await this.recordLlmRun(ctx, reportingPeriodId, true, "error", 0, 0, 0, 0, Date.now() - startedAt, generator.model.modelId, generator.model.modelVersion, generator.model.promptVersion);
        draft.setGeneratedByAi(false);
        const correctedDraft = await this.drafts.update(draft);
        if (!correctedDraft.ok) return correctedDraft;
      }
    }
    creditReserved = false;

    period.transitionTo(period.status);
    period.setDonorTemplate(period.donorTemplateId ?? "");
    const updatedPeriod = await this.periods.update(period);

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.draft.generated",
      entityType: "report_draft",
      entityId: draftId,
      projectId: period.projectId,
      newValue: `sections=${sectionIds.length};claims=${claimCount};generatedByAi=${realAiGenerated};fallback=${usedFallback};run=${run.id}`,
    });

    return { ok: true, value: { draftId, sectionIds, claimCount, planId: plan.id, generationRunId: run.id } };
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
      billableUnits: status === "success" ? 1 : 0,
      requestId: `${reportingPeriodId}:${Date.now()}`,
    });
  }

  private buildReportContext(
    project: { title: string; projectCode: string; donorName: string; implementingOrganization: string; partnerOrganization?: string; country: string; region?: string; district?: string; sector: string; duration: { start: Date; end: Date }; budget?: { amount: number; currency: string } | null; reportingFrequency: string; description?: string },
    period: { reportType: string; duration: { start: Date; end: Date }; deadline: Date; internalReviewDeadline?: Date; readinessScore: number; daysUntilDeadline(): number },
    template?: { templateName: string; donorName: string; language: string; requiredAnnexes: string[]; notes?: string; version: number } | undefined,
  ): ReportGenerationContext {
    const startDate = project.duration.start.toISOString();
    const endDate = project.duration.end.toISOString();
    return {
      project: {
        title: project.title,
        projectCode: project.projectCode,
        donorName: project.donorName,
        implementingOrganization: project.implementingOrganization,
        partnerOrganization: project.partnerOrganization,
        country: project.country,
        region: project.region,
        district: project.district,
        sector: project.sector,
        startDate,
        endDate,
        description: project.description,
        budgetAmount: project.budget?.amount,
        budgetCurrency: project.budget?.currency,
        reportingFrequency: project.reportingFrequency,
      },
      period: {
        reportType: period.reportType,
        startDate: period.duration.start.toISOString(),
        endDate: period.duration.end.toISOString(),
        deadline: period.deadline.toISOString(),
        internalReviewDeadline: period.internalReviewDeadline?.toISOString(),
        readinessScore: period.readinessScore,
        daysUntilDeadline: period.daysUntilDeadline(),
      },
      template: template
        ? {
            templateName: template.templateName,
            donorName: template.donorName,
            language: template.language,
            requiredAnnexes: template.requiredAnnexes,
            notes: template.notes,
            version: template.version,
          }
        : undefined,
    };
  }

  private buildManualSections(planSections: Array<{ templateSectionId: string; title: string }>): Array<{
    sectionId: string;
    title: string;
    content: string;
    claims: [];
    sourceReferences: [];
  }> {
    const sections = planSections.length > 0
      ? planSections
      : [{ templateSectionId: "manual-narrative", title: "Narrative Report" }];
    return sections.map((section) => ({
      sectionId: section.templateSectionId,
      title: section.title,
      content: "",
      claims: [],
      sourceReferences: [],
    }));
  }
}
