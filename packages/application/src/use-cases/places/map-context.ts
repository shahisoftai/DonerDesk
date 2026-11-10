import { DomainError, Permissions, checkMapContext, err, ok, parseMapContext, type MapContextSettings, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { IMapContextRepository } from "../../ports/map-context.js";

/** Which context layers the organisation's maps offer, and its imagery address (Phase 49.6). Every member reads it; outside partners get none. */
export class GetMapContextHandler {
  constructor(private readonly repo: IMapContextRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<MapContextSettings & { canEdit: boolean }, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "project.view")) return err(DomainError.forbidden("You cannot see the maps"));
    const canEdit = Permissions.can(ctx.tenant.role as Role, "org.manage");
    // Imagery is the one thing that calls an outside service: an outside partner's map never does.
    if ((ctx.tenant as { external?: boolean }).external) return ok({ ...parseMapContext(null), canEdit: false });
    const row = await this.repo.find(ctx.tenant.tenantId);
    if (!row.ok) return row;
    return ok({ ...parseMapContext(row.value?.settingsJson), canEdit });
  }
}

export class UpdateMapContextHandler {
  constructor(private readonly repo: IMapContextRepository, private readonly audit: IAuditLogger, private readonly _ids?: IIdGenerator) {}

  async handle(ctx: AuthenticatedContext, input: { layers?: string[]; imageryUrl?: string | null; imageryCredit?: string | null }): Promise<Result<MapContextSettings, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "org.manage")) return err(DomainError.forbidden("Only an administrator can change the map settings"));
    const checked = checkMapContext(input);
    if (!checked.ok) return err(DomainError.validation(PROBLEM_TEXT[checked.problem] ?? "The map settings could not be saved", { code: checked.problem }));
    const before = await this.repo.find(ctx.tenant.tenantId);
    if (!before.ok) return before;
    const saved = await this.repo.save(ctx.tenant.tenantId, JSON.stringify(checked.value), ctx.tenant.userId);
    if (!saved.ok) return saved;
    const old = parseMapContext(before.value?.settingsJson);
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "organization.map_context_updated", entityType: "organization", entityId: ctx.tenant.tenantId.toString(),
      oldValue: JSON.stringify({ layers: old.layers, imagery: old.imageryUrl !== null }), newValue: JSON.stringify({ layers: checked.value.layers, imagery: checked.value.imageryUrl !== null, imageryHost: checked.value.imageryUrl ? new URL(checked.value.imageryUrl.replace(/\{[^}]+\}/g, "0")).hostname : null }),
    });
    return ok(checked.value);
  }
}

const PROBLEM_TEXT: Readonly<Record<string, string>> = {
  NOT_HTTPS: "The imagery address must start with https://",
  NO_TILE_PLACEHOLDERS: "The imagery address must be a tile address with {z}, {x} and {y} (or {bbox-epsg-3857})",
  HAS_CREDENTIALS: "Do not put a user name or password in the imagery address",
  PRIVATE_ADDRESS: "The imagery address must be on the public internet",
  TOO_LONG: "The imagery address is too long",
  NOT_A_URL: "The imagery address is not a web address",
  UNKNOWN_LAYER: "One of the layers is not a layer DonorDesk offers",
  CREDIT_TOO_LONG: "The imagery credit is too long (200 characters at most)",
};
