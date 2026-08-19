import type { Result } from "@donordesk/domain";
import { DomainError, createRequirementPack, createAwardOverride, type ReportingRequirement, type ReportingRequirementPack, type AwardReportingOverride, type RequirementSourceReference } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IRequirementPackRepository, IAwardOverrideRepository } from "../../ports/reporting.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";

/**
 * Creates or updates a versioned requirement pack. New packs start in DRAFT;
 * they only become controlling after a human review activates them.
 */
export class UpsertRequirementPackHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly packs: IRequirementPackRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: {
    id?: string;
    donorKey: string;
    mechanismKey: string;
    reportType: string;
    name: string;
    language?: string;
    requirements: ReportingRequirement[];
  }): Promise<Result<ReportingRequirementPack, DomainError>> {
    if (input.id) {
      const existing = await this.packs.findById(input.id, ctx.tenant.tenantId.toString());
      if (!existing.ok) return existing;
      if (!existing.value) return { ok: false, error: DomainError.notFound("ReportingRequirementPack", input.id) };
      const updated: ReportingRequirementPack = {
        ...existing.value,
        requirements: input.requirements,
        updatedAt: new Date(),
      };
      const saved = await this.packs.update(updated);
      if (!saved.ok) return saved;
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "report.requirement.pack.updated",
        entityType: "reporting_requirement_pack",
        entityId: updated.id,
        newValue: JSON.stringify({ requirements: input.requirements.length, status: updated.status }),
      });
      return { ok: true, value: updated };
    }

    const pack = createRequirementPack({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      donorKey: input.donorKey,
      mechanismKey: input.mechanismKey,
      reportType: input.reportType,
      language: input.language,
      name: input.name,
      requirements: input.requirements,
      status: "DRAFT",
    });
    const saved = await this.packs.create(pack);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.requirement.pack.created",
      entityType: "reporting_requirement_pack",
      entityId: pack.id,
      newValue: JSON.stringify({ donorKey: pack.donorKey, mechanismKey: pack.mechanismKey, reportType: pack.reportType, version: pack.version }),
    });
    return { ok: true, value: pack };
  }
}

/**
 * Activates a reviewed requirement pack. Only a human review can move a pack
 * from DRAFT/REVIEWED to ACTIVE where it can control production reports.
 */
export class ActivateRequirementPackHandler {
  constructor(private readonly packs: IRequirementPackRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, packId: string): Promise<Result<void, DomainError>> {
    const existing = await this.packs.findById(packId, ctx.tenant.tenantId.toString());
    if (!existing.ok) return existing;
    if (!existing.value) return { ok: false, error: DomainError.notFound("ReportingRequirementPack", packId) };
    const pack = { ...existing.value, status: "ACTIVE" as const, updatedAt: new Date() };
    const saved = await this.packs.update(pack);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.requirement.pack.published",
      entityType: "reporting_requirement_pack",
      entityId: pack.id,
      newValue: JSON.stringify({ status: "ACTIVE", version: pack.version }),
    });
    return { ok: true, value: undefined };
  }
}

/**
 * Creates or updates an award-specific reporting override. New overrides start
 * in DRAFT; an override controls reports only after activation (human review).
 */
export class UpsertAwardOverrideHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly overrides: IAwardOverrideRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: {
    id?: string;
    awardId: string;
    projectId: string;
    effectiveFrom: string;
    effectiveTo?: string;
    documentHash?: string;
    requirements: ReportingRequirement[];
    sourceReference: RequirementSourceReference;
  }): Promise<Result<AwardReportingOverride, DomainError>> {
    if (input.id) {
      const existing = await this.overrides.findById(input.id, ctx.tenant.tenantId);
      if (!existing.ok) return existing;
      if (!existing.value) return { ok: false, error: DomainError.notFound("AwardReportingOverride", input.id) };
      const updated: AwardReportingOverride = {
        ...existing.value,
        requirements: input.requirements,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        documentHash: input.documentHash ?? existing.value.documentHash,
        sourceReference: input.sourceReference,
        updatedAt: new Date(),
      };
      const saved = await this.overrides.update(updated);
      if (!saved.ok) return saved;
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "report.requirement.override.updated",
        entityType: "award_reporting_override",
        entityId: updated.id,
        newValue: JSON.stringify({ requirements: input.requirements.length, awardId: updated.awardId }),
      });
      return { ok: true, value: updated };
    }

    const override = createAwardOverride({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: input.projectId,
      awardId: input.awardId,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      documentHash: input.documentHash,
      requirements: input.requirements,
      sourceReference: input.sourceReference,
    });
    const saved = await this.overrides.create(override);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.requirement.override.created",
      entityType: "award_reporting_override",
      entityId: override.id,
      newValue: JSON.stringify({ awardId: override.awardId, projectId: override.projectId, version: override.version }),
    });
    return { ok: true, value: override };
  }
}
