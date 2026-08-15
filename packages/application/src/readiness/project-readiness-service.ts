import type { Result, DomainError, TenantId } from "@donordesk/domain";
import type { IProjectRepository, IProjectReadinessService, ProjectReadiness, ProjectReadinessSnapshot } from "../ports/projects.js";
import type { IProjectSetupRepository, IReportingProfileRepository } from "../ports/setup.js";
import type { IDonorTemplateRepository } from "../ports/templates.js";
import type { IIndicatorRepository } from "../ports/logframe.js";
import type { IUserRepository } from "../ports/identity.js";

/**
 * Derived readiness: NEVER persist readiness booleans. This service computes the
 * current state from source data on every read and immediately before gated
 * mutations, so it can never go stale.
 */
export class ProjectReadinessService implements IProjectReadinessService {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly setup: IProjectSetupRepository,
    private readonly profiles: IReportingProfileRepository,
    private readonly templates: IDonorTemplateRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly users: IUserRepository,
    private readonly providerResolver: {
      resolve(tenantId: TenantId): Promise<Result<{ provider: string }, DomainError>>;
    },
  ) {}

  async compute(projectId: string, tenantId: TenantId): Promise<Result<ProjectReadiness, DomainError>> {
    const blockers: ProjectReadiness["blockers"] = [];

    const projectResult = await this.projects.findById(projectId, tenantId);
    if (!projectResult.ok) return projectResult;
    if (!projectResult.value) {
      return { ok: true, value: { ready: false, status: "NOT_STARTED", blockers: [] } };
    }

    // 1. Workspace readiness.
    const setupResult = await this.setup.findByProject(projectId, tenantId);
    if (!setupResult.ok) return setupResult;
    const setup = setupResult.value;
    const providerResult = await this.providerResolver.resolve(tenantId);
    if (!providerResult.ok) return providerResult;
    const provider = providerResult.value.provider;
    const provisionStatus =
      setup?.workspaceProvisionStatus ?? (provider === "GOOGLE_DRIVE" ? "PENDING" : "NOT_REQUIRED");
    const effectiveProvisionStatus =
      provider !== "GOOGLE_DRIVE" && provisionStatus !== "FAILED" ? "NOT_REQUIRED" : provisionStatus;
    if (effectiveProvisionStatus === "PENDING" || effectiveProvisionStatus === "IN_PROGRESS") {
      blockers.push({ code: "WORKSPACE_PENDING", label: "Project workspace is being provisioned", retryable: true });
    } else if (effectiveProvisionStatus === "FAILED") {
      blockers.push({
        code: "WORKSPACE_PROVISION_FAILED",
        label: setup?.workspaceProvisionError ?? "Project workspace provisioning failed",
        retryable: true,
      });
    }

    // 2. Reporting profile.
    const profileResult = await this.profiles.findByProject(projectId, tenantId);
    if (!profileResult.ok) return profileResult;
    const profile = profileResult.value;

    // 3. Active template (profile-selected or any template on the project).
    const templatesResult = await this.templates.findByProject(projectId, tenantId);
    if (!templatesResult.ok) return templatesResult;
    const projectTemplates = templatesResult.value;

    const activeTemplate = profile?.defaultTemplateId
      ? projectTemplates.find((t) => t.id === profile.defaultTemplateId) ?? null
      : projectTemplates[0] ?? null;

    if (profile) {
      if (profile.defaultTemplateId && !activeTemplate) {
        blockers.push({ code: "DEFAULT_TEMPLATE_MISSING", label: "The default template is no longer available", href: "/logframe" });
      }
    } else {
      blockers.push({ code: "REPORTING_PROFILE_MISSING", label: "Set up your reporting profile", href: "/reporting-profile" });
    }

    if (profile && activeTemplate) {
      const sectionIdsInvalid =
        profile.sectionOverrides &&
        Object.keys(profile.sectionOverrides).some((id) => !activeTemplate.sections.some((s) => s.id === id));
      if (sectionIdsInvalid) {
        blockers.push({
          code: "SECTION_OVERRIDE_INVALID",
          label: "A profile word-count override references a section that no longer exists",
          href: "/reporting-profile",
        });
      }
    }

    // 4. Template section review.
    if (activeTemplate) {
      const reviewedRequired = activeTemplate.sections.filter((s) => s.required && s.reviewStatus === "REVIEWED");
      const idsValid = activeTemplate.sections.every((s) => Boolean(s.id));
      if (reviewedRequired.length === 0) {
        blockers.push({
          code: "TEMPLATE_HAS_NO_REVIEWED_REQUIRED_SECTIONS",
          label: "The active template has no reviewed required sections",
          href: "/templates",
        });
      }
      if (!idsValid) {
        blockers.push({ code: "TEMPLATE_SECTION_IDS_INVALID", label: "Template sections are missing stable IDs", href: "/templates" });
      }
    }

    // 5. Indicators.
    const indicatorsResult = await this.indicators.findByProject(projectId, tenantId);
    if (!indicatorsResult.ok) return indicatorsResult;
    const projectIndicators = indicatorsResult.value;
    const reportable = projectIndicators.filter((ind) => this.isReportable(ind));
    if (projectIndicators.length === 0) {
      blockers.push({ code: "NO_REPORTABLE_INDICATORS", label: "Add at least one indicator to your logframe", href: "/logframe" });
    } else if (reportable.length === 0) {
      blockers.push({
        code: "INDICATOR_CONFIGURATION_INCOMPLETE",
        label: "Indicators are missing baseline, target, unit, or frequency",
        href: "/logframe",
      });
    }

    const ready = blockers.length === 0;
    const status = this.deriveStatus(ready, Boolean(setup?.acknowledgedAt), provisionStatus);
    const nextAction = ready ? undefined : blockers[0];

    return {
      ok: true,
      value: { ready, status, blockers, nextAction },
    };
  }

  async snapshot(projectId: string, tenantId: TenantId): Promise<Result<ProjectReadinessSnapshot, DomainError>> {
    const projectResult = await this.projects.findById(projectId, tenantId);
    if (!projectResult.ok) return projectResult;

    const setupResult = await this.setup.findByProject(projectId, tenantId);
    if (!setupResult.ok) return setupResult;
    const setup = setupResult.value;
    const providerResult = await this.providerResolver.resolve(tenantId);
    if (!providerResult.ok) return providerResult;
    const provider = providerResult.value.provider;
    const snapshotProvisionStatus =
      setup?.workspaceProvisionStatus ?? (provider === "GOOGLE_DRIVE" ? "PENDING" : "NOT_REQUIRED");

    const profileResult = await this.profiles.findByProject(projectId, tenantId);
    if (!profileResult.ok) return profileResult;
    const profile = profileResult.value;

    const templatesResult = await this.templates.findByProject(projectId, tenantId);
    if (!templatesResult.ok) return templatesResult;
    const projectTemplates = templatesResult.value;

    const indicatorsResult = await this.indicators.findByProject(projectId, tenantId);
    if (!indicatorsResult.ok) return indicatorsResult;
    const projectIndicators = indicatorsResult.value;

    const activeTemplate = profile?.defaultTemplateId
      ? projectTemplates.find((t) => t.id === profile.defaultTemplateId) ?? null
      : projectTemplates[0] ?? null;

    const reportable = projectIndicators.filter((ind) => this.isReportable(ind));

    const usersResult = await this.users.listByTenant(tenantId);
    if (!usersResult.ok) return usersResult;

    return {
      ok: true,
      value: {
        workspace: {
          provisionStatus:
            provider !== "GOOGLE_DRIVE" && snapshotProvisionStatus !== "FAILED"
              ? "NOT_REQUIRED"
              : snapshotProvisionStatus,
          provisionError: setup?.workspaceProvisionError,
          rootId: projectResult.value?.workspaceRootId,
        },
        profile: profile
          ? {
              exists: true,
              version: profile.version,
              defaultTemplateId: profile.defaultTemplateId,
              language: profile.language,
              tone: profile.tone,
            }
          : { exists: false },
        template: activeTemplate
          ? {
              exists: true,
              id: activeTemplate.id,
              name: activeTemplate.templateName,
              reviewedRequiredSectionCount: activeTemplate.sections.filter(
                (s) => s.required && s.reviewStatus === "REVIEWED",
              ).length,
            }
          : { exists: false, reviewedRequiredSectionCount: 0 },
        indicators: {
          total: projectIndicators.length,
          reportable: reportable.length,
          incomplete: projectIndicators.length - reportable.length,
        },
        team: {
          assigned: Boolean(
            projectResult.value?.projectManagerId ||
              projectResult.value?.meOfficerId ||
              projectResult.value?.reportingOfficerId,
          ),
          memberCount: usersResult.value.length,
        },
        acknowledgedAt: setup?.acknowledgedAt?.toISOString(),
        acknowledgedById: setup?.acknowledgedById,
      },
    };
  }

  private deriveStatus(ready: boolean, acknowledged: boolean, provisionStatus: string): ProjectReadiness["status"] {
    if (!ready && provisionStatus === "FAILED") return "ACTION_REQUIRED";
    if (ready) return "READY";
    if (acknowledged) return "ACTION_REQUIRED";
    return "IN_PROGRESS";
  }

  private isReportable(ind: {
    baseline: string;
    target: string;
    unit?: string;
    frequency?: string;
    type: string;
  }): boolean {
    const hasBaseline = this.nonEmpty(ind.baseline);
    const hasTarget = this.nonEmpty(ind.target);
    const hasUnit = this.nonEmpty(ind.unit);
    const hasFrequency = this.nonEmpty(ind.frequency);
    // YES_NO / TEXT types do not require numeric baseline/target; unit+frequency
    // are still meaningful but only strongly required for quantitative types.
    const quantitative = ind.type !== "YES_NO" && ind.type !== "TEXT";
    if (quantitative) return hasBaseline && hasTarget && hasUnit && hasFrequency;
    return true;
  }

  private nonEmpty(value: string | undefined): boolean {
    return typeof value === "string" && value.trim().length > 0;
  }
}
