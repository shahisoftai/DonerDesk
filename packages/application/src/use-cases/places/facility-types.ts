import { DomainError, Permissions, SUGGESTED_FACILITY_TYPES, err, facilityTypeListProblems, normalizeFacilityTypeKey, ok, type FacilityType, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IFacilityTypeRepository } from "../../ports/facility-types.js";

export interface FacilityTypesDto { types: FacilityType[]; suggested: Record<string, readonly FacilityType[]>; canEdit: boolean }

/** The organisation's facility types and the starting lists by sector (Phase 50.3b). Every member reads them; an administrator changes them. */
export class GetFacilityTypesHandler {
  constructor(private readonly repo: IFacilityTypeRepository) {}
  async handle(ctx: AuthenticatedContext): Promise<Result<FacilityTypesDto, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "project.view")) return err(DomainError.forbidden("You cannot see the places list"));
    const found = await this.repo.find(ctx.tenant.tenantId);
    if (!found.ok) return found;
    return ok({ types: found.value, suggested: { ...SUGGESTED_FACILITY_TYPES }, canEdit: Permissions.can(ctx.tenant.role as Role, "org.manage") });
  }
}

export class SaveFacilityTypesHandler {
  constructor(private readonly repo: IFacilityTypeRepository, private readonly audit: IAuditLogger) {}
  async handle(ctx: AuthenticatedContext, input: { types: Array<{ key: string; label: string; sector?: string | undefined }> }): Promise<Result<FacilityType[], DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "org.manage")) return err(DomainError.forbidden("Only an administrator can change the facility types"));
    const types = input.types.map((t) => ({ key: normalizeFacilityTypeKey(t.key), label: t.label.trim(), ...(t.sector ? { sector: t.sector } : {}) }));
    const problems = facilityTypeListProblems(types);
    if (problems.length) return err(DomainError.validation(problems[0]!, { field: "types" }));
    const before = await this.repo.find(ctx.tenant.tenantId);
    const saved = await this.repo.save(ctx.tenant.tenantId, types);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "organization.facility_types_saved", entityType: "organization", entityId: ctx.tenant.tenantId.toString(), oldValue: JSON.stringify({ count: before.ok ? before.value.length : null }), newValue: JSON.stringify({ count: types.length, keys: types.map((t) => t.key) }) });
    return ok(types);
  }
}
