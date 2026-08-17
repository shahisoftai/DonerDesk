import type { Result } from "@donordesk/domain";
import { DomainError, ReportDraft, ReportSection, ReportClaim, ReportGenerationRun } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportingPeriodRepository,
  IReportDraftRepository,
  IReportSectionRepository,
  IReportDraftGenerator,
  IReportPlanner,
  IIndicatorAnalyticsService,
  IClaimVerifier,
  IGenerationRunRepository,
  IReportPlanRepository,
  IReportClaimRepository,
  IEvidencePackageBuilder,
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
 * immutable generation snapshot -> drafting -> claim verification -> claim and
 * plan persistence. The LLM (or stub) only narrates verified findings; every
 * numeric claim is verified deterministically before it is persisted.
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
    private readonly verifier: IClaimVerifier,
    private readonly generationRuns: IGenerationRunRepository,
    private readonly reportPlans: IReportPlanRepository,
    private readonly reportClaims: IReportClaimRepository,
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
            reportingProfileSnapshot,
            generationRunId: run.id,
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
    const claimSectionMap = new Map<string, Array<{ text: string; type: ReportClaim["type"]; proposedSources: Array<{ evidenceId: string; chunkId: string; sourceText: string }> }>>();

    for (let i = 0; i < generated.length; i++) {
      const g = generated[i]!;
      const sectionId = this.ids.generate();
      sectionIds.push(sectionId);
      claimSectionMap.set(sectionId, g.claims ?? []);
      const section = ReportSection.create({
        id: sectionId,
        tenantId: ctx.tenant.tenantId.toString(),
        reportDraftId: draftId,
        sectionTitle: g.title,
        sectionOrder: i,
        content: g.content,
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
    }

    // Verify every claim deterministically before persisting.
    let claimCount = 0;
    for (const [sectionId, claims] of claimSectionMap) {
      for (const claim of claims) {
        const verificationResult = await this.verifier.verify({
          claim,
          findings: verifiedFindings,
          evidencePackages,
        });
        if (!verificationResult.ok) {
          if (creditReserved) {
            await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStartUtc(new Date()), -1n);
          }
          return verificationResult;
        }
        const v = verificationResult.value;
        const reportClaim = ReportClaim.create({
          id: this.ids.generate(),
          tenantId: ctx.tenant.tenantId.toString(),
          projectId: period.projectId,
          reportDraftId: draftId,
          sectionId,
          text: claim.text,
          type: claim.type,
          sources: claim.proposedSources.map((s) => {
            const pkg = evidencePackages.find((p) => p.evidenceId === s.evidenceId);
            return {
              evidenceId: s.evidenceId,
              chunkId: s.chunkId,
              sourceText: s.sourceText,
              evidenceHash: pkg?.evidenceHash ?? "",
              evidenceUpdatedAt: pkg?.evidenceUpdatedAt ?? new Date(),
              chunkerVersion: pkg?.chunkerVersion ?? "unknown",
            };
          }),
          verificationResult: v.result,
          verificationDetail: v.detail,
        });
        const savedClaim = await this.reportClaims.create(reportClaim);
        if (!savedClaim.ok) {
          if (creditReserved) {
            await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_AI_CREDITS, monthStartUtc(new Date()), -1n);
          }
          return savedClaim;
        }
        claimCount++;
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
