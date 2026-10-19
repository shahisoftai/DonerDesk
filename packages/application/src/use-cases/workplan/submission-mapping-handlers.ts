import { DomainError, Permissions, checkSubmissionMapping, err, ok, type Result, type Role, type SubmissionMapping } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { IProjectSubmissionMappingRepository } from "../../ports/workplan.js";

/** The saved mapping of a project, or none. Anyone who may add people to the project can read it. */
export class GetSubmissionMappingHandler {
  constructor(private readonly mappings: IProjectSubmissionMappingRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ mapping: SubmissionMapping | null }, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "activity.create")) return err(DomainError.forbidden("You cannot add people to this project"));
    const found = await this.mappings.find(projectId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    return ok({ mapping: (found.value as SubmissionMapping | null) });
  }
}

/** Saves the column mapping for a project's imports. Managers only, audited. Checks the required fields are set. */
export class SaveSubmissionMappingHandler {
  constructor(private readonly mappings: IProjectSubmissionMappingRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, projectId: string, mapping: SubmissionMapping): Promise<Result<void, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "workplan.manage")) return err(DomainError.forbidden("You cannot change how imports are read"));
    // Headers are checked against the file at import; here only the shape and the required fields.
    const shape = checkSubmissionMapping(mapping, Object.values(mapping).filter((v): v is string => typeof v === "string"));
    if (!shape.ok) return shape;
    const saved = await this.mappings.save(projectId, mapping as Record<string, string>, { userId: ctx.tenant.userId, now: this.clock.now() }, ctx.tenant.tenantId);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "beneficiary.mapping_saved", entityType: "project", entityId: projectId, projectId,
      newValue: JSON.stringify(Object.keys(mapping)),
    });
    return ok(undefined);
  }
}
