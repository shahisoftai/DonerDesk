import type { Result, DomainError } from "@donordesk/domain";
import { ReportingProfile, DomainError as DE } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingProfileRepository } from "../../ports/setup.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { UpsertReportingProfileInput } from "@donordesk/contracts";

export interface ReportingProfileDto {
  id: string;
  tenantId: string;
  projectId: string;
  defaultTemplateId?: string;
  language: string;
  tone: string;
  writingStyle?: string;
  audienceNotes?: string;
  formattingRules: string[];
  specialRequirements: string[];
  sectionOverrides: Record<string, { min?: number; max?: number }>;
  deadlineOffsetDays?: number;
  autoPeriodCreation: boolean;
  version: number;
  createdAt: string;
}

export function toReportingProfileDto(p: ReportingProfile): ReportingProfileDto {
  return {
    id: p.id,
    tenantId: p.tenantIdValue,
    projectId: p.projectId,
    defaultTemplateId: p.defaultTemplateId,
    language: p.language,
    tone: p.tone,
    writingStyle: p.writingStyle,
    audienceNotes: p.audienceNotes,
    formattingRules: p.formattingRules,
    specialRequirements: p.specialRequirements,
    sectionOverrides: p.sectionOverrides,
    deadlineOffsetDays: p.deadlineOffsetDays,
    autoPeriodCreation: p.autoPeriodCreation,
    version: p.version,
    createdAt: p.createdAt.toISOString(),
  };
}

export class GetReportingProfileHandler {
  constructor(private readonly profiles: IReportingProfileRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ profile: ReportingProfileDto | null }, DomainError>> {
    const r = await this.profiles.findByProject(projectId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    return { ok: true, value: { profile: r.value ? toReportingProfileDto(r.value) : null } };
  }
}

export class UpsertReportingProfileHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly profiles: IReportingProfileRepository,
    private readonly templates: IDonorTemplateRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    projectId: string,
    input: UpsertReportingProfileInput,
  ): Promise<Result<{ profile: ReportingProfileDto; created: boolean }, DomainError>> {
    // Validate the selected template belongs to the same tenant/project.
    if (input.defaultTemplateId) {
      const t = await this.templates.findById(input.defaultTemplateId, ctx.tenant.tenantId);
      if (!t.ok) return t;
      if (!t.value || t.value.projectId !== projectId) {
        return { ok: false, error: DE.notFound("DonorTemplate", input.defaultTemplateId) };
      }
    }

    const existingResult = await this.profiles.findByProject(projectId, ctx.tenant.tenantId);
    if (!existingResult.ok) return existingResult;
    const existing = existingResult.value;

    if (existing) {
      if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
        return {
          ok: false,
          error: DE.conflict(`Reporting profile version mismatch: expected ${input.expectedVersion}, current ${existing.version}`),
        };
      }
      existing.update({
        defaultTemplateId: input.defaultTemplateId,
        language: input.language,
        tone: input.tone,
        writingStyle: input.writingStyle,
        audienceNotes: input.audienceNotes,
        formattingRules: input.formattingRules,
        specialRequirements: input.specialRequirements,
        sectionOverrides: input.sectionOverrides,
        deadlineOffsetDays: input.deadlineOffsetDays,
        autoPeriodCreation: input.autoPeriodCreation,
        updatedById: ctx.tenant.userId,
      });
      const saved = await this.profiles.update(existing);
      if (!saved.ok) return saved;
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "project.reporting_profile.updated",
        entityType: "reporting_profile",
        entityId: existing.id,
        projectId,
        newValue: JSON.stringify({ version: existing.version, tone: existing.tone, language: existing.language }),
      });
      return { ok: true, value: { profile: toReportingProfileDto(existing), created: false } };
    }

    const profile = ReportingProfile.create({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      projectId,
      defaultTemplateId: input.defaultTemplateId,
      language: input.language,
      tone: input.tone,
      writingStyle: input.writingStyle,
      audienceNotes: input.audienceNotes,
      formattingRules: input.formattingRules,
      specialRequirements: input.specialRequirements,
      sectionOverrides: input.sectionOverrides,
      deadlineOffsetDays: input.deadlineOffsetDays,
      autoPeriodCreation: input.autoPeriodCreation,
      createdById: ctx.tenant.userId,
    });
    const saved = await this.profiles.create(profile);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "project.reporting_profile.created",
      entityType: "reporting_profile",
      entityId: profile.id,
      projectId,
      newValue: JSON.stringify({ version: 1, tone: profile.tone, language: profile.language }),
    });
    return { ok: true, value: { profile: toReportingProfileDto(profile), created: true } };
  }
}
