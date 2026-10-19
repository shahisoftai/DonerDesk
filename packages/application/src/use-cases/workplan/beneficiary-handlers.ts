import { DomainError, Permissions, checkBeneficiary, duplicateCheck, beneficiaryCounts, parseSubmissions, err, ok, type Result, type Role, type SubmissionMapping } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { BeneficiaryRecord, IBeneficiaryRepository, IPlanContextReader, IProjectSubmissionMappingRepository } from "../../ports/workplan.js";

/** Only people on the project (or an admin) see or add its beneficiaries. */
export async function onProject(ctx: AuthenticatedContext, context: IPlanContextReader, projectId: string): Promise<Result<void, DomainError>> {
  if (ctx.tenant.role === "ADMIN") return ok(undefined);
  const members = await context.activeMemberIds(projectId, ctx.tenant.tenantId);
  if (!members.ok) return members;
  return members.value.has(ctx.tenant.userId) ? ok(undefined) : err(DomainError.forbidden("You are not on this project"));
}

export class RegisterBeneficiaryHandler {
  constructor(private readonly repo: IBeneficiaryRepository, private readonly context: IPlanContextReader, private readonly ids: IIdGenerator, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: { caseCode: string; sex: string; ageGroup: string; location?: string; enrolledOn: string; consentRecorded: boolean }): Promise<Result<{ id: string; probableDuplicates: string[] }, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "activity.create")) return err(DomainError.forbidden("You cannot add people to this project"));
    const member = await onProject(ctx, this.context, projectId);
    if (!member.ok) return member;
    const checked = checkBeneficiary(input as Parameters<typeof checkBeneficiary>[0]);
    if (!checked.ok) return checked;
    const existing = await this.repo.findByProject(projectId, ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    const check = duplicateCheck(checked.value, existing.value);
    if (check.refused) return err(DomainError.conflict(check.message ?? "This case code is already used", { field: "caseCode" }));
    const id = this.ids.generate();
    const saved = await this.repo.add({
      id, tenantId: ctx.tenant.tenantId.toString(), projectId, caseCode: checked.value.caseCode, sex: checked.value.sex, ageGroup: checked.value.ageGroup,
      location: checked.value.location, enrolledOn: checked.value.enrolledOn, consentRecordedById: ctx.tenant.userId, createdById: ctx.tenant.userId, createdAt: this.clock.now(),
    });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "beneficiary.registered", entityType: "beneficiary", entityId: id, projectId,
      newValue: JSON.stringify({ sex: checked.value.sex, ageGroup: checked.value.ageGroup, probableDuplicates: check.probable.length }),
    });
    return ok({ id, probableDuplicates: check.probable });
  }
}

export class ListBeneficiariesHandler {
  constructor(private readonly repo: IBeneficiaryRepository, private readonly context: IPlanContextReader) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ items: BeneficiaryRecord[]; counts: ReturnType<typeof beneficiaryCounts> }, DomainError>> {
    const member = await onProject(ctx, this.context, projectId);
    if (!member.ok) return member;
    const rows = await this.repo.findByProject(projectId, ctx.tenant.tenantId);
    if (!rows.ok) return rows;
    return ok({ items: rows.value, counts: beneficiaryCounts(rows.value) });
  }
}

/**
 * Adds the people in a KoboToolbox or ODK export. Every row is checked first; a bad row or a case code already in the project
 * refuses the whole file and names the line. Nothing is saved unless every row is right.
 */
export class ImportSubmissionsHandler {
  constructor(
    private readonly repo: IBeneficiaryRepository, private readonly context: IPlanContextReader, private readonly ids: IIdGenerator, private readonly audit: IAuditLogger, private readonly clock: IClock,
    private readonly mappings?: IProjectSubmissionMappingRepository,
  ) {}

  /** `mapping` overrides the project's saved mapping for this file; without either, the headers are matched by name. */
  async handle(ctx: AuthenticatedContext, projectId: string, csv: string, mapping?: SubmissionMapping): Promise<Result<{ added: number }, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "activity.create")) return err(DomainError.forbidden("You cannot add people to this project"));
    const member = await onProject(ctx, this.context, projectId);
    if (!member.ok) return member;
    let chosen = mapping;
    if (!chosen && this.mappings) {
      const saved = await this.mappings.find(projectId, ctx.tenant.tenantId);
      if (!saved.ok) return saved;
      chosen = (saved.value ?? undefined) as SubmissionMapping | undefined;
    }
    const parsed = parseSubmissions(csv, chosen);
    if (!parsed.ok) return parsed;
    if (parsed.value.problems.length > 0) {
      const shown = parsed.value.problems.slice(0, 5).map((p) => p.message).join(". ");
      const more = parsed.value.problems.length > 5 ? ` and ${parsed.value.problems.length - 5} more` : "";
      return err(DomainError.validation(`${shown}${more}. Nothing was imported.`));
    }
    const existing = await this.repo.findByProject(projectId, ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    for (const row of parsed.value.rows) {
      const clash = existing.value.some((e) => e.caseCode === row.caseCode);
      if (clash) return err(DomainError.validation(`Line ${row.line}: case code ${row.caseCode} is already in this project. Nothing was imported.`));
    }
    const now = this.clock.now();
    const records = parsed.value.rows.map((row) => ({
      id: this.ids.generate(), tenantId: ctx.tenant.tenantId.toString(), projectId, caseCode: row.caseCode, sex: row.sex, ageGroup: row.ageGroup,
      location: row.location, enrolledOn: row.enrolledOn, consentRecordedById: ctx.tenant.userId, createdById: ctx.tenant.userId, createdAt: now,
    }));
    if (records.length === 0) return err(DomainError.validation("The file has no submissions to import"));
    const saved = await this.repo.addMany(records);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "beneficiary.imported", entityType: "beneficiary", entityId: projectId, projectId,
      newValue: JSON.stringify({ added: records.length }),
    });
    return ok({ added: records.length });
  }
}

/** Corrects a person's case code or group. The case code may not match another person's in the project. */
export class UpdateBeneficiaryHandler {
  constructor(private readonly repo: IBeneficiaryRepository, private readonly context: IPlanContextReader, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, id: string, input: { caseCode: string; sex: string; ageGroup: string; location?: string; enrolledOn: string; consentRecorded: boolean }): Promise<Result<void, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "activity.create")) return err(DomainError.forbidden("You cannot change people on this project"));
    const found = await this.repo.findById(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return err(DomainError.notFound("Person", id));
    const member = await onProject(ctx, this.context, found.value.projectId);
    if (!member.ok) return member;
    const checked = checkBeneficiary(input as Parameters<typeof checkBeneficiary>[0]);
    if (!checked.ok) return checked;
    const all = await this.repo.findByProject(found.value.projectId, ctx.tenant.tenantId);
    if (!all.ok) return all;
    const check = duplicateCheck(checked.value, all.value.filter((e) => e.id !== id));
    if (check.refused) return err(DomainError.conflict(check.message ?? "This case code is already used", { field: "caseCode" }));
    const saved = await this.repo.update(id, ctx.tenant.tenantId, checked.value);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "beneficiary.updated", entityType: "beneficiary", entityId: id, projectId: found.value.projectId,
      newValue: JSON.stringify({ sex: checked.value.sex, ageGroup: checked.value.ageGroup }),
    });
    return ok(undefined);
  }
}

/** Removes a person added by mistake, with the links to the activities they were counted in. Audited. */
export class RemoveBeneficiaryHandler {
  constructor(private readonly repo: IBeneficiaryRepository, private readonly context: IPlanContextReader, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "activity.create")) return err(DomainError.forbidden("You cannot remove people from this project"));
    const found = await this.repo.findById(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return err(DomainError.notFound("Person", id));
    const member = await onProject(ctx, this.context, found.value.projectId);
    if (!member.ok) return member;
    const gone = await this.repo.remove(id, ctx.tenant.tenantId);
    if (!gone.ok) return gone;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "beneficiary.removed", entityType: "beneficiary", entityId: id, projectId: found.value.projectId,
      oldValue: JSON.stringify({ sex: found.value.sex, ageGroup: found.value.ageGroup }),
    });
    return ok(undefined);
  }
}
