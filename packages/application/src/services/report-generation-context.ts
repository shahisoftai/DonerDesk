import type { Result, DonorTemplate, Project, ReportingPeriod, TemplateSection, VerifiedFinding } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type {
  IReportingPeriodRepository,
  IReportDraftGenerator,
  IIndicatorAnalyticsService,
  IEvidencePackageBuilder,
  ReportingProfileSnapshot,
  ReportGenerationContext,
  EvidencePackage,
  ActivityGenerationContext,
  IndicatorUpdateGenerationContext,
} from "../ports/reporting.js";
import { excludeRestrictedEvidence } from "../ports/reporting.js";
import type { IProjectRepository } from "../ports/projects.js";
import type { IIndicatorUpdateRepository } from "../ports/logframe.js";
import type { IActivityUpdateRepository } from "../ports/activities.js";
import type { IDonorTemplateRepository } from "../ports/templates.js";
import type { IOrganizationRepository } from "../ports/identity.js";

/** Who/what a generation run writes with, and the donor structure it follows. */
export interface GenerationBase {
  period: ReportingPeriod;
  project: Project;
  aiEnabled: boolean;
  generator: IReportDraftGenerator;
  /** A real (non-stub) provider on an AI-enabled organisation. */
  chargeAiCredits: boolean;
  /** Charged against DonorDesk credits (not the tenant's own provider). */
  meterPlatformCredits: boolean;
  template: DonorTemplate | undefined;
  templateSections: TemplateSection[];
  templateVersion: number;
  reportingProfileSnapshot: ReportingProfileSnapshot;
}

/** The period's data a section is written from (snapshotted per run). */
export interface GenerationInputs {
  verifiedFindings: VerifiedFinding[];
  indicatorUpdateIds: string[];
  activityIds: string[];
  evidenceIds: string[];
  evidencePackages: EvidencePackage[];
  indicatorUpdates: IndicatorUpdateGenerationContext[];
  activities: ActivityGenerationContext[];
  reportContext: ReportGenerationContext;
}

const DEFAULT_PROFILE: ReportingProfileSnapshot = { tone: "FORMAL", language: "en", formattingRules: [], sectionOverrides: {} };

export function parseProfileSnapshot(json: string): ReportingProfileSnapshot {
  if (!json || json === "{}") return { ...DEFAULT_PROFILE };
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
    return { ...DEFAULT_PROFILE };
  }
}

/**
 * Assembles everything a report generation needs from the period: the
 * generator and credit policy, the donor template, and the snapshot of
 * findings, indicator updates, activities and evidence the writer narrates.
 * Shared by the full-draft and single-section generation handlers so both
 * write from exactly the same inputs.
 */
export class ReportGenerationContextBuilder {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly projects: IProjectRepository,
    private readonly organizations: IOrganizationRepository,
    private readonly templates: IDonorTemplateRepository,
    private readonly indicatorUpdates: IIndicatorUpdateRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly analytics: IIndicatorAnalyticsService,
    private readonly evidencePackages: IEvidencePackageBuilder,
    private readonly getGenerator: (tenantId?: string) => Promise<IReportDraftGenerator>,
  ) {}

  async loadBase(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<GenerationBase, DomainError>> {
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
    // A tenant drafting with its own AI provider pays that provider directly:
    // DonorDesk AI credits are neither checked nor consumed, and the run is
    // recorded with zero billable units so it never counts against the ledger.
    const usesTenantProvider = generator.providerSource === "TENANT";

    const templateResult = period.donorTemplateId ? await this.templates.findById(period.donorTemplateId, ctx.tenant.tenantId) : undefined;
    const template = templateResult?.ok && templateResult.value ? templateResult.value : undefined;

    return {
      ok: true,
      value: {
        period,
        project,
        aiEnabled,
        generator,
        chargeAiCredits,
        meterPlatformCredits: chargeAiCredits && !usesTenantProvider,
        template,
        templateSections: template ? template.sections : [],
        templateVersion: template ? template.version : 1,
        reportingProfileSnapshot: parseProfileSnapshot(period.reportingProfileSnapshotJson),
      },
    };
  }

  async loadInputs(ctx: AuthenticatedContext, reportingPeriodId: string, base: GenerationBase): Promise<Result<GenerationInputs, DomainError>> {
    const { period, project } = base;
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
    const evidencePackages = excludeRestrictedEvidence(evidencePackagesResult.value);

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

    return {
      ok: true,
      value: {
        verifiedFindings,
        indicatorUpdateIds: updatesResult.value.map((u) => u.id),
        activityIds: activitiesResult.value.map((a) => a.id),
        evidenceIds,
        evidencePackages,
        indicatorUpdates,
        activities,
        reportContext: buildReportContext(project, period, base.template, period.storyContext),
      },
    };
  }
}

export function buildReportContext(
  project: { title: string; projectCode: string; donorName: string; implementingOrganization: string; partnerOrganization?: string; country: string; region?: string; district?: string; sector: string; duration: { start: Date; end: Date }; budget?: { amount: number; currency: string } | null; reportingFrequency: string; description?: string },
  period: { reportType: string; duration: { start: Date; end: Date }; deadline: Date; internalReviewDeadline?: Date; readinessScore: number; daysUntilDeadline(): number },
  template?: { templateName: string; donorName: string; language: string; requiredAnnexes: string[]; notes?: string; version: number } | undefined,
  storyContext?: { achievements?: string; challenges?: string; varianceExplanations?: string; adaptations?: string; lessons?: string },
): ReportGenerationContext {
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
      startDate: project.duration.start.toISOString(),
      endDate: project.duration.end.toISOString(),
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
    storyContext,
  };
}
