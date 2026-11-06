import type { Result, DomainError } from "@donordesk/domain";
import { Project, ProjectSetup, ReportingProfile, LogframeItem, Indicator, DonorTemplate, createSection } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IProjectSetupRepository, IReportingProfileRepository } from "../../ports/setup.js";
import type { ILogframeRepository, IIndicatorRepository } from "../../ports/logframe.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { DemoContentSeeder } from "../../services/demo-content-seeder.js";

/**
 * DonorDesk Academy (Feature 22): seeds one self-contained, reporting-ready
 * "demo" project into the caller's tenant so the guided tour has a real
 * project to walk through. Content mirrors the existing EERP nutrition
 * scenario (`packages/infrastructure/src/db/seed-eerp.ts`) at a smaller
 * scale — a real logframe, indicators, and a REVIEWED donor template, not
 * placeholder rows — so every step of the tour (indicators, template review,
 * reporting period, AI draft, editor, export) is actually reachable.
 *
 * Idempotent: a tenant has at most one demo project. Re-invoking returns the
 * existing one rather than creating a duplicate.
 */
export class CreateDemoProjectHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly projects: IProjectRepository,
    private readonly setup: IProjectSetupRepository,
    private readonly profiles: IReportingProfileRepository,
    private readonly logframe: ILogframeRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly templates: IDonorTemplateRepository,
    private readonly audit: IAuditLogger,
    /** Fills the first quarter (period, verified values, activities); without it the demo has the framework and template only. */
    private readonly content?: DemoContentSeeder,
  ) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<{ id: string; reused: boolean; /** Why the first quarter was left out, when it was. */ contentNote?: string }, DomainError>> {
    const existing = await this.projects.listByTenant(ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    const existingDemo = existing.value.find((p) => p.isDemo);
    if (existingDemo) return { ok: true, value: { id: existingDemo.id, reused: true } };

    const projectId = this.ids.generate();
    // The project began three months ago, so its first quarter has just ended and there is already something to report.
    const today = new Date();
    const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3, 1));
    const endDate = new Date(Date.UTC(startDate.getUTCFullYear() + 1, startDate.getUTCMonth(), 0, 23, 59, 59));

    const project = Project.create({
      id: projectId,
      tenantId: ctx.tenant.tenantId,
      props: {
        title: "Community Nutrition Programme (Demo)",
        projectCode: "DEMO-NUTRITION",
        donorName: "Sample Donor Foundation",
        implementingOrganization: "Your Organization",
        country: "Kenya",
        sector: "NUTRITION",
        startDate,
        endDate,
        reportingFrequency: "QUARTERLY",
        description:
          "A sample 12-month community nutrition programme used by the DonorDesk Academy guided " +
          "tour. Safe to explore, edit, or delete — it never counts against your plan limits.",
        isDemo: true,
      },
    });
    const savedProject = await this.projects.create(project);
    if (!savedProject.ok) return savedProject;

    // Non-Drive workspace: the tour must work before/without Google Drive setup.
    const setup = ProjectSetup.create({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      projectId,
      status: "NOT_REQUIRED",
    });
    const savedSetup = await this.setup.create(setup);
    if (!savedSetup.ok) return savedSetup;

    const goal = LogframeItem.create({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      projectId,
      level: "GOAL",
      code: "GOAL-1",
      title: "Reduce acute malnutrition among children under 5 in the target districts",
    });
    const outcome = LogframeItem.create({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      projectId,
      parentId: goal.id,
      level: "OUTCOME",
      code: "OUTCOME-1",
      title: "Increased access to nutrition screening and treatment services",
    });
    const output = LogframeItem.create({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      projectId,
      parentId: outcome.id,
      level: "OUTPUT",
      code: "OUTPUT-1",
      title: "Community health workers trained and equipped for MUAC screening",
    });
    for (const item of [goal, outcome, output]) {
      const r = await this.logframe.create(item);
      if (!r.ok) return r;
    }

    const indicatorSpecs: Array<{ code: string; name: string; type: "NUMBER" | "PERCENTAGE"; baseline: string; target: string; unit: string }> = [
      {
        code: "IND-1",
        name: "Number of children under 5 screened for acute malnutrition",
        type: "NUMBER",
        baseline: "0",
        target: "5000",
        unit: "children",
      },
      {
        code: "IND-2",
        name: "Percentage of screened children referred for treatment who complete the treatment protocol",
        type: "PERCENTAGE",
        baseline: "0",
        target: "85",
        unit: "%",
      },
    ];
    const createdIndicators: Array<{ id: string; code: string }> = [];
    for (const spec of indicatorSpecs) {
      const indicator = Indicator.create({
        id: this.ids.generate(),
        tenantId: ctx.tenant.tenantId.toString(),
        projectId,
        logframeItemId: output.id,
        code: spec.code,
        name: spec.name,
        type: spec.type,
        baseline: spec.baseline,
        target: spec.target,
        unit: spec.unit,
        frequency: "QUARTERLY",
      });
      const r = await this.indicators.create(indicator);
      if (!r.ok) return r;
      createdIndicators.push({ id: indicator.id, code: spec.code });
    }

    const templateId = this.ids.generate();
    const template = DonorTemplate.create({
      id: templateId,
      tenantId: ctx.tenant.tenantId,
      projectId,
      templateName: "Sample Donor Quarterly Report Template",
      donorName: "Sample Donor Foundation",
      reportType: "QUARTERLY",
      language: "en",
      uploadedById: ctx.tenant.userId,
      status: "REVIEWED",
      sections: [
        createSection({
          title: "Executive Summary",
          description: "A brief overview of progress against the programme goal and outcomes.",
          inputType: "NARRATIVE",
          required: true,
          reviewStatus: "REVIEWED",
          order: 0,
          level: 1,
          numbering: "1",
        }),
        createSection({
          title: "Results Against Indicators",
          description: "Progress against each indicator's baseline and target for this period.",
          inputType: "INDICATOR_TABLE",
          required: true,
          reviewStatus: "REVIEWED",
          order: 1,
          level: 1,
          numbering: "2",
          mandatoryQuestions: ["What progress was made against each indicator this period?"],
        }),
      ],
    });
    const savedTemplate = await this.templates.create(template);
    if (!savedTemplate.ok) return savedTemplate;

    const profile = ReportingProfile.create({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      projectId,
      defaultTemplateId: templateId,
      language: "en",
      tone: "FORMAL",
      createdById: ctx.tenant.userId,
    });
    const savedProfile = await this.profiles.create(profile);
    if (!savedProfile.ok) return savedProfile;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "project.demo.created",
      entityType: "project",
      entityId: projectId,
      projectId,
      newValue: project.title,
    });

    // Best effort: a refusal leaves the demo without the first quarter, never without the demo.
    let contentNote: string | undefined;
    if (this.content) {
      const seeded = await this.content.seed(ctx, { projectId, startDate, outputId: output.id, indicators: createdIndicators }).catch((e: unknown) => ({ seeded: false, reason: e instanceof Error ? e.message : String(e) }));
      if (!seeded.seeded) contentNote = seeded.reason ?? "The first quarter could not be added.";
    }

    return { ok: true, value: { id: projectId, reused: false, ...(contentNote ? { contentNote } : {}) } };
  }
}
