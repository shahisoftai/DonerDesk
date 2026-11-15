import { DomainError, Permissions, PlaceTree, err, ok, type Permission, type Project, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import { toRecord } from "./place-support.js";

/** What the Phase 56 handlers share: the whole tree (retired and merged rows included, so old ids resolve) and the project the caller may see. Internal to this folder. */
export async function loadTree(repo: IPlaceRepository, ctx: AuthenticatedContext): Promise<Result<PlaceTree, DomainError>> {
  const listed = await repo.list(ctx.tenant.tenantId, { includeArchived: true });
  if (!listed.ok) return listed;
  return ok(new PlaceTree(listed.value.map(toRecord)));
}

export const can = (ctx: AuthenticatedContext, permission: Permission): boolean => Permissions.can(ctx.tenant.role as Role, permission);

/** The project, only when the caller may see it; anything else is "not found" (never says the project exists). */
export async function visibleProject(projects: IProjectRepository, visible: VisibleProjects, ctx: AuthenticatedContext, projectId: string): Promise<Result<Project, DomainError>> {
  const found = await projects.findById(projectId, ctx.tenant.tenantId);
  if (!found.ok) return found;
  if (!found.value) return err(DomainError.notFound("Project", projectId));
  const seen = await visible.for(ctx);
  if (!seen.ok) return seen;
  if (!seen.value.some((p) => p.id === projectId)) return err(DomainError.notFound("Project", projectId));
  return ok(found.value);
}

export interface PlaceBrief {
  id: string;
  name: string;
  /** "Village 1 › Town T › District A1". */
  path: string;
  adminLevel: number;
  kind: "POINT" | "AREA";
  facility: boolean;
  /** The P-code or the organisation's own code, when it has one (joins boundaries). */
  code?: string;
  latitude?: number;
  longitude?: number;
}

export function brief(tree: PlaceTree, id: string): PlaceBrief | null {
  const p = tree.get(id);
  if (!p) return null;
  return {
    id: p.id, name: p.name, path: tree.path(p.id), adminLevel: p.adminLevel, kind: p.kind, facility: p.facility === true, ...(p.code ? { code: p.code } : {}),
    ...(p.latitude !== undefined && p.longitude !== undefined ? { latitude: p.latitude, longitude: p.longitude } : {}),
  };
}
