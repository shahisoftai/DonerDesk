import type { FinanceSummaryView, Result, Project, ReportingPeriod, ReportScope, TemplateSection, VerifiedFinding } from "@donordesk/domain";
import { DomainError, describeReportScope, blueprintSectionsFor, templateAppliesToReportType } from "@donordesk/domain";
import { taggedEvidenceIds } from "./period-evidence.js";
import { resolveGenerationActivities, resolvePeriodActivities, scopeIndicatorData } from "./period-activities.js";
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
import type { PeriodTemplateSnapshot } from "./template-snapshot.js";
import type { PeriodTemplateResolver } from "./period-template-resolver.js";
import type { IOrganizationRepository } from "../ports/identity.js";
import type { IFinanceInputs } from "./finance-inputs.js";
import type { IEvidenceRepository } from "../ports/evidence.js";

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
  /** The donor template version this run follows (see PeriodTemplateResolver). */
  template: PeriodTemplateSnapshot | undefined;
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
  /** Verified financial figures, when the project uses them and this kind of report has a financial section. */
  finance?: FinanceSummaryView;
  /** Situation reports: this report's scope and the previous report on the same event, for the figures table. */
  situation?: { current: ReportScope; previous?: ReportScope };
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
    private readonly templateResolver: PeriodTemplateResolver,
    private readonly indicatorUpdates: IIndicatorUpdateRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly analytics: IIndicatorAnalyticsService,
    private readonly evidencePackages: IEvidencePackageBuilder,
    private readonly getGenerator: (tenantId?: string) => Promise<IReportDraftGenerator>,
    /** Absent when the deployment has no finance support: reports are written without financial figures. */
    private readonly finance?: IFinanceInputs,
    /** Absent: only evidence attached to an activity or indicator update reaches the writer. */
    private readonly evidenceFiles?: IEvidenceRepository,
  ) {}

  /**
   * `templateMode`: a full draft adopts the latest reviewed template ("latest");
   * section regenerate/rewrite follow the version pinned on the period ("pinned").
   */
  async loadBase(ctx: AuthenticatedContext, reportingPeriodId: string, templateMode: "pinned" | "latest" = "pinned"): Promise<Result<GenerationBase, DomainError>> {
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

    const templateResult = await this.templateResolver.resolve(period, ctx.tenant.tenantId, templateMode);
    if (!templateResult.ok) return templateResult;
    // A donor template is optional. It structures the report only when attached
    // and applicable (a short activity/situation report never takes a full-report
    // template); otherwise the report type's built-in blueprint does.
    const attached = templateResult.value;
    const template = attached && templateAppliesToReportType(period.reportType, attached.reportType) ? attached : undefined;
    let templateSections = template ? template.sections : [];
    if (!template) {
      const scoped = period.reportType === "ACTIVITY" ? await resolvePeriodActivities(this.activities, period, ctx.tenant.tenantId) : null;
      if (scoped && !scoped.ok) return scoped;
      const finance = await this.verifiedFinance(period, ctx.tenant.tenantId);
      if (!finance.ok) return finance;
      templateSections = blueprintSectionsFor({
        reportType: period.reportType,
        financeAvailable: finance.value !== undefined,
        scope: period.scope,
        language: parseProfileSnapshot(period.reportingProfileSnapshotJson).language,
        activities: scoped?.value.map((a) => ({ id: a.id, title: a.activityTitle, date: a.activityDate.toISOString().slice(0, 10), location: a.location })),
      });
    }

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
        templateSections,
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
    const activitiesResult = await resolveGenerationActivities(this.activities, period, ctx.tenant.tenantId);
    if (!activitiesResult.ok) return activitiesResult;
    const previousScope = await this.loadPreviousSituationScope(period, ctx.tenant.tenantId);
    if (!previousScope.ok) return previousScope;
    const finance = await this.verifiedFinance(period, ctx.tenant.tenantId);
    if (!finance.ok) return finance;

    const allUpdatesResult = await this.indicatorUpdates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!allUpdatesResult.ok) return allUpdatesResult;
    const scoped = scopeIndicatorData(period.reportType, activitiesResult.value, findingsResult.value, allUpdatesResult.value);
    const verifiedFindings = scoped.findings;
    const updatesResult = { ok: true as const, value: scoped.updates };

    // Evidence that is attached to a record, plus verified evidence tagged to this period or to one of its
    // activities: uploading a file with those tags is how most evidence arrives, and a file the reporter has
    // verified for this period should not be invisible to the writer because nobody attached it as well.
    const taggedIds = await taggedEvidenceIds(this.evidenceFiles, period, activitiesResult.value.map((a) => a.id), ctx.tenant.tenantId);
    if (!taggedIds.ok) return taggedIds;
    const evidenceIds = Array.from(new Set([
      ...updatesResult.value.flatMap((u) => u.attachedEvidenceIds),
      ...activitiesResult.value.flatMap((a) => a.attachedEvidenceIds),
      ...taggedIds.value,
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
        ...(finance.value ? { finance: finance.value } : {}),
        ...(period.reportType === "SITUATION" ? { situation: { current: period.scope, ...(previousScope.value ? { previous: previousScope.value } : {}) } } : {}),
        reportContext: buildReportContext(project, period, base.template, period.storyContext, describeReportScope(period.reportType, period.scope, activitiesResult.value.map((a) => a.activityTitle), previousScope.value)),
      },
    };
  }
  /** The period's verified financial figures; undefined when finance is off, not applicable or not verified. */
  private async verifiedFinance(period: ReportingPeriod, tenantId: AuthenticatedContext["tenant"]["tenantId"]): Promise<Result<FinanceSummaryView | undefined, DomainError>> {
    if (!this.finance) return { ok: true, value: undefined };
    return this.finance.verifiedFor(period, tenantId);
  }

  /** The previous report on the same event (situation follow-ups only); absent for the first report or when it is gone. */
  private async loadPreviousSituationScope(period: ReportingPeriod, tenantId: AuthenticatedContext["tenant"]["tenantId"]): Promise<Result<ReportScope | undefined, DomainError>> {
    const previousId = period.reportType === "SITUATION" ? period.scope.previousPeriodId : undefined;
    if (!previousId) return { ok: true, value: undefined };
    const previous = await this.periods.findById(previousId, tenantId);
    if (!previous.ok) return previous;
    return { ok: true, value: previous.value?.scope };
  }
}

export function buildReportContext(
  project: { title: string; projectCode: string; donorName: string; implementingOrganization: string; partnerOrganization?: string; country: string; region?: string; district?: string; sector: string; duration: { start: Date; end: Date }; budget?: { amount: number; currency: string } | null; reportingFrequency: string; description?: string },
  period: { reportType: string; duration: { start: Date; end: Date }; deadline: Date; internalReviewDeadline?: Date; readinessScore: number; daysUntilDeadline(): number },
  template?: PeriodTemplateSnapshot,
  storyContext?: { achievements?: string; challenges?: string; varianceExplanations?: string; adaptations?: string; lessons?: string },
  scope?: string,
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
      daysUntilDeadline: period.daysUntilDeadline(),
      ...(scope ? { scope } : {}),
    },
    template: template ? buildTemplateGenerationContext(template) : undefined,
    storyContext,
  };
}

function nonEmpty(values: string[]): string[] | undefined {
  return values.length > 0 ? values : undefined;
}

/** Report-wide donor requirements the writer must honour (absent when empty). */
export function buildTemplateGenerationContext(template: PeriodTemplateSnapshot): NonNullable<ReportGenerationContext["template"]> {
  const r = template.requirements;
  const formattingRules = [
    ...r.formatting.rules,
    ...(r.formatting.maxPages ? [`The whole report must not exceed ${r.formatting.maxPages} pages.`] : []),
    ...(r.formatting.font ? [`Font: ${r.formatting.font}.`] : []),
  ];
  const submission = [...r.submission.instructions, ...(r.submission.deadlineRule ? [`Deadline: ${r.submission.deadlineRule}`] : [])];
  const compliance = r.compliance.map((c) => c.text);
  const indicators = r.indicatorRequirements.map((i) => (i.disaggregation.length ? `${i.text} (disaggregate by: ${i.disaggregation.join(", ")})` : i.text));
  return {
    templateName: template.templateName,
    donorName: template.donorName,
    language: template.language,
    requiredAnnexes: r.annexes.filter((a) => a.required).map((a) => a.name),
    notes: template.notes,
    version: template.version,
    ...(r.reportTitle ? { reportTitle: r.reportTitle } : {}),
    ...(nonEmpty(r.generalInstructions) ? { generalInstructions: r.generalInstructions } : {}),
    ...(nonEmpty(formattingRules) ? { formattingRules } : {}),
    ...(nonEmpty(submission) ? { submissionInstructions: submission } : {}),
    ...(nonEmpty(compliance) ? { complianceRequirements: compliance } : {}),
    ...(nonEmpty(indicators) ? { indicatorRequirements: indicators } : {}),
  };
}
