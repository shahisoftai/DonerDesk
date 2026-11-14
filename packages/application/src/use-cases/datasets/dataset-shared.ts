import { DomainError, PlaceRegistry, Permissions, canContributeToDataset, canManageDataset, canSeeDataset, type DatasetViewer, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDatasetCatalog, StoredDataset } from "../../ports/datasets.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IStorage } from "../../ports/infrastructure.js";

export const can = (ctx: AuthenticatedContext, p: Parameters<typeof Permissions.can>[1]): boolean => Permissions.can(ctx.tenant.role as Role, p);
export const fail = <T>(error: DomainError): Result<T, DomainError> => ({ ok: false, error });
export const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });

/** The facts the access rules read about the person (`access.ts`): an outside partner is never given more by a dataset route. */
export function viewerOf(ctx: AuthenticatedContext, projectManager = false): DatasetViewer {
  return { userId: ctx.tenant.userId, canManageOrg: can(ctx, "org.manage"), canManage: can(ctx, "dataset.manage"), canContribute: can(ctx, "dataset.contribute"), external: false, isProjectManager: projectManager };
}

export interface DatasetDeps { catalog: IDatasetCatalog; visible: Pick<VisibleProjects, "for">; audit: IAuditLogger; clock: IClock; ids: IIdGenerator; storage: IStorage; places: IPlaceRepository }

/** The project ids the person can see (organisation datasets are seen by everyone with `project.view`). */
export async function visibleIds(deps: Pick<DatasetDeps, "visible">, ctx: AuthenticatedContext): Promise<Result<Set<string>, DomainError>> {
  const mine = await deps.visible.for(ctx);
  return mine.ok ? ok(new Set(mine.value.map((p) => p.id))) : mine;
}

/** A dataset the person may see, or "not found" (never "forbidden": its existence is not revealed). */
export async function loadDataset(deps: Pick<DatasetDeps, "catalog" | "visible">, ctx: AuthenticatedContext, id: string): Promise<Result<StoredDataset, DomainError>> {
  if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see datasets"));
  const found = await deps.catalog.findById(id, ctx.tenant.tenantId);
  if (!found.ok) return found;
  const d = found.value;
  if (!d || !canSeeDataset(d, viewerOf(ctx))) return fail(DomainError.notFound("Dataset", id));
  if (d.projectId) {
    const ids = await visibleIds(deps, ctx);
    if (!ids.ok) return ids;
    if (!ids.value.has(d.projectId)) return fail(DomainError.notFound("Dataset", id));
  }
  return ok(d);
}

export async function loadManaged(deps: Pick<DatasetDeps, "catalog" | "visible">, ctx: AuthenticatedContext, id: string): Promise<Result<StoredDataset, DomainError>> {
  const d = await loadDataset(deps, ctx, id);
  if (!d.ok) return d;
  return canManageDataset(d.value, viewerOf(ctx)) ? d : fail(DomainError.forbidden(d.value.scope === "ORGANISATION" ? "Only an administrator can change an organisation dataset" : "Only an administrator or a project manager can change this dataset"));
}

export async function loadForContribution(deps: Pick<DatasetDeps, "catalog" | "visible">, ctx: AuthenticatedContext, id: string): Promise<Result<{ dataset: StoredDataset; manager: boolean }, DomainError>> {
  const d = await loadDataset(deps, ctx, id);
  if (!d.ok) return d;
  const v = viewerOf(ctx);
  if (!canContributeToDataset(d.value, v)) return fail(DomainError.forbidden("You cannot add data to this dataset"));
  return ok({ dataset: d.value, manager: canManageDataset(d.value, v) });
}

/** The organisation's places, for matching place columns. */
export async function placeRegistry(places: IPlaceRepository, ctx: AuthenticatedContext): Promise<PlaceRegistry | undefined> {
  const all = await places.list(ctx.tenant.tenantId);
  if (!all.ok) return undefined;
  return new PlaceRegistry(all.value.map(({ tenantId: _t, createdById: _c, archivedAt: _a, ...record }) => record));
}

/** Where an uploaded file waits until it is saved, and where a version's file is kept (encrypted at rest like evidence). */
export const uploadKey = (ctx: AuthenticatedContext, id: string): string => `datasets/${ctx.tenant.tenantId.toString()}/uploads/${ctx.tenant.userId}/${id}`;
export const ownsUpload = (ctx: AuthenticatedContext, key: string): boolean => key.startsWith(`datasets/${ctx.tenant.tenantId.toString()}/uploads/${ctx.tenant.userId}/`);
