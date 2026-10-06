import type { Result } from "@donordesk/domain";
import { DomainError, ReportingProfile, ALL_REPORT_TYPES, templateAppliesToReportType } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingProfileRepository } from "../../ports/setup.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";

/** The project's reporting profile, created with its normal defaults when it has none yet. */
class ProfileAccess {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly profiles: IReportingProfileRepository,
  ) {}

  async loadOrCreate(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ profile: ReportingProfile; created: boolean }, DomainError>> {
    const found = await this.profiles.findByProject(projectId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (found.value) return { ok: true, value: { profile: found.value, created: false } };
    const profile = ReportingProfile.create({ id: this.ids.generate(), tenantId: ctx.tenant.tenantId.toString(), projectId, createdById: ctx.tenant.userId });
    return { ok: true, value: { profile, created: true } };
  }

  async save(profile: ReportingProfile, created: boolean): Promise<Result<void, DomainError>> {
    const saved = created ? await this.profiles.create(profile) : await this.profiles.update(profile);
    return saved.ok ? { ok: true, value: undefined } : saved;
  }
}

/** A statement that holds for every period of the project (a branding policy, a waste procedure). */
export class SetStandingStatementHandler {
  private readonly access: ProfileAccess;
  constructor(ids: IIdGenerator, profiles: IReportingProfileRepository, private readonly audit: IAuditLogger) {
    this.access = new ProfileAccess(ids, profiles);
  }

  async handle(ctx: AuthenticatedContext, projectId: string, input: { key: string; text: string }): Promise<Result<void, DomainError>> {
    if (!input.key || input.key.length > 120) return { ok: false, error: DomainError.validation("A statement needs a section key") };
    const loaded = await this.access.loadOrCreate(ctx, projectId);
    if (!loaded.ok) return loaded;
    loaded.value.profile.setStandingStatement(input.key, input.text, ctx.tenant.userId);
    const saved = await this.access.save(loaded.value.profile, loaded.value.created);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "reporting_profile.standing_statement_set", entityType: "reporting_profile", entityId: loaded.value.profile.id, projectId });
    return { ok: true, value: undefined };
  }
}

/** Makes a template the default for ONE report type; uploading or approving a template never changes any default. */
export class SetTemplateDefaultForTypeHandler {
  private readonly access: ProfileAccess;
  constructor(ids: IIdGenerator, profiles: IReportingProfileRepository, private readonly templates: IDonorTemplateRepository, private readonly audit: IAuditLogger) {
    this.access = new ProfileAccess(ids, profiles);
  }

  async handle(ctx: AuthenticatedContext, templateId: string, input: { reportType: string; isDefault: boolean }): Promise<Result<void, DomainError>> {
    if (!ALL_REPORT_TYPES.includes(input.reportType)) return { ok: false, error: DomainError.validation("Unknown report type") };
    const found = await this.templates.findById(templateId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const template = found.value;
    if (!template) return { ok: false, error: DomainError.notFound("DonorTemplate", templateId) };
    if (input.isDefault && !templateAppliesToReportType(input.reportType, template.reportType)) {
      return { ok: false, error: DomainError.validation(`A ${template.reportType.toLowerCase().replace(/_/g, " ")} template cannot structure a ${input.reportType.toLowerCase().replace(/_/g, " ")} report`) };
    }
    const loaded = await this.access.loadOrCreate(ctx, template.projectId);
    if (!loaded.ok) return loaded;
    const { profile, created } = loaded.value;
    // Clearing a template that is not that type's default changes nothing.
    if (!input.isDefault && profile.defaultTemplateByType[input.reportType] !== templateId) return { ok: true, value: undefined };
    profile.setDefaultTemplateForType(input.reportType, input.isDefault ? templateId : undefined, ctx.tenant.userId);
    const saved = await this.access.save(profile, created);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: input.isDefault ? "template.set_default_for_type" : "template.unset_default_for_type",
      entityType: "donor_template",
      entityId: templateId,
      projectId: template.projectId,
      newValue: JSON.stringify({ reportType: input.reportType }),
    });
    return { ok: true, value: undefined };
  }
}

/** Whether the author of a report may approve it. Off by default; a team of one leaves it off. */
export class SetRequireSecondApproverHandler {
  private readonly access: ProfileAccess;
  constructor(ids: IIdGenerator, profiles: IReportingProfileRepository, private readonly audit: IAuditLogger) {
    this.access = new ProfileAccess(ids, profiles);
  }

  async handle(ctx: AuthenticatedContext, projectId: string, value: boolean): Promise<Result<void, DomainError>> {
    const loaded = await this.access.loadOrCreate(ctx, projectId);
    if (!loaded.ok) return loaded;
    const { profile, created } = loaded.value;
    if (!created && profile.requireSecondApprover === value) return { ok: true, value: undefined };
    profile.setRequireSecondApprover(value, ctx.tenant.userId);
    const saved = await this.access.save(profile, created);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "reporting_profile.second_approver_set", entityType: "reporting_profile", entityId: profile.id, projectId, newValue: JSON.stringify({ requireSecondApprover: value }) });
    return { ok: true, value: undefined };
  }
}
