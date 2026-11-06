import { DomainError, Permissions, PlaceRegistry, err, ok, type PlaceRecord, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IPlaceRepository, StoredPlace } from "../../ports/places.js";

/** What every place handler needs: who may do what, and the list read once with its registry. Internal to this folder. */
export const canEdit = (ctx: AuthenticatedContext) => Permissions.can(ctx.tenant.role as Role, "project.edit");
export const canView = (ctx: AuthenticatedContext) => Permissions.can(ctx.tenant.role as Role, "project.view");
export const forbidden = () => err(DomainError.forbidden("You cannot change the list of places"));

export function toRecord(p: StoredPlace): PlaceRecord {
  const { tenantId: _t, createdById: _c, archivedAt: _a, ...record } = p;
  return { ...record, archived: p.archived || p.archivedAt !== undefined };
}

export async function loadAll(repo: IPlaceRepository, ctx: AuthenticatedContext, includeArchived = false): Promise<Result<{ stored: StoredPlace[]; registry: PlaceRegistry }, DomainError>> {
  const listed = await repo.list(ctx.tenant.tenantId, { includeArchived });
  if (!listed.ok) return listed;
  return ok({ stored: listed.value, registry: new PlaceRegistry(listed.value.map(toRecord)) });
}

