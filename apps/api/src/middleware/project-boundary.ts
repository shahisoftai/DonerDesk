import type { FastifyReply, FastifyRequest } from "fastify";
import { DomainError } from "@donordesk/domain";

/**
 * Project membership is an access boundary, not only a list filter. A person who is not an administrator reaches a
 * project's data only while they hold an active membership of it (or are named as its manager, M&E or reporting
 * officer); removing someone from a project removes their access to every route about it, not just its row in the
 * list. A denied request answers "not found", so it does not confirm that the project exists.
 *
 * The project is found from the route: `/v1/projects/:id/...` names it, and the entity routes (`reporting-periods`,
 * `report-drafts`, `evidence`, …) name a record that belongs to one. A record that cannot be found passes through so
 * the handler gives its own 404. Routes whose project is only in the request body are checked by their handlers.
 */
export type ScopeLookup =
  | { kind: "project"; id: string }
  | { kind: "entity"; entity: EntityName; id: string };

export type EntityName =
  | "reportingPeriod" | "reportDraft" | "reportSection" | "reportClaim" | "evidenceFile"
  | "activityUpdate" | "indicator" | "indicatorUpdate" | "plannedActivity";

/** The first path segment after /v1/ that names a record, and what it names. */
export const ENTITY_ROUTES: Readonly<Record<string, EntityName>> = {
  "reporting-periods": "reportingPeriod",
  "report-drafts": "reportDraft",
  "report-sections": "reportSection",
  "report-claims": "reportClaim",
  evidence: "evidenceFile",
  activities: "activityUpdate",
  indicators: "indicator",
  "indicator-updates": "indicatorUpdate",
  "work-plan": "plannedActivity",
};

/** Words that sit where an id would in routes that act on no single record. */
const NOT_AN_ID = new Set(["import", "upload", "parse-file", "parse-sheet", "bulk", "link-drive", "search", "template", "bulk-verify", "new", "start", "bulk-action", "verify-all", "suggest-links"]);

export function projectScopeOf(rawPath: string): ScopeLookup | null {
  const path = rawPath.split("?", 1)[0] ?? rawPath;
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "v1" || parts.length < 3) return null;
  const head = parts[1] as string;
  const id = parts[2] as string;
  if (NOT_AN_ID.has(id)) return null;
  if (head === "projects") return { kind: "project", id };
  const entity = ENTITY_ROUTES[head];
  return entity ? { kind: "entity", entity, id } : null;
}

interface Row { projectId?: string | null; reportDraftId?: string | null; indicatorId?: string | null }
type Delegate = { findFirst(args: { where: { id: string }; select: Record<string, true> }): Promise<Row | null> };

/** The project a record belongs to, or null when it cannot be found. Reads through the caller's tenant-scoped client. */
export async function projectOf(prisma: Record<string, unknown>, scope: ScopeLookup): Promise<string | null> {
  if (scope.kind === "project") return scope.id;
  const table = (name: string): Delegate => prisma[name] as Delegate;
  switch (scope.entity) {
    case "reportingPeriod": return (await table("reportingPeriod").findFirst({ where: { id: scope.id }, select: { projectId: true } }))?.projectId ?? null;
    case "reportDraft": return (await table("reportDraft").findFirst({ where: { id: scope.id }, select: { projectId: true } }))?.projectId ?? null;
    case "reportClaim": return (await table("reportClaim").findFirst({ where: { id: scope.id }, select: { projectId: true } }))?.projectId ?? null;
    case "evidenceFile": return (await table("evidenceFile").findFirst({ where: { id: scope.id }, select: { projectId: true } }))?.projectId ?? null;
    case "activityUpdate": return (await table("activityUpdate").findFirst({ where: { id: scope.id }, select: { projectId: true } }))?.projectId ?? null;
    case "indicator": return (await table("indicator").findFirst({ where: { id: scope.id }, select: { projectId: true } }))?.projectId ?? null;
    case "plannedActivity": return (await table("plannedActivity").findFirst({ where: { id: scope.id }, select: { projectId: true } }))?.projectId ?? null;
    case "reportSection": {
      const section = await table("reportSection").findFirst({ where: { id: scope.id }, select: { reportDraftId: true } });
      return section?.reportDraftId ? ((await table("reportDraft").findFirst({ where: { id: section.reportDraftId }, select: { projectId: true } }))?.projectId ?? null) : null;
    }
    case "indicatorUpdate": {
      const update = await table("indicatorUpdate").findFirst({ where: { id: scope.id }, select: { indicatorId: true } });
      return update?.indicatorId ? ((await table("indicator").findFirst({ where: { id: update.indicatorId }, select: { projectId: true } }))?.projectId ?? null) : null;
    }
  }
}

type Db = Record<string, unknown> & {
  projectMember: { findFirst(args: unknown): Promise<unknown | null> };
  project: { findFirst(args: unknown): Promise<{ projectManagerId: string | null; meOfficerId: string | null; reportingOfficerId: string | null } | null> };
};

/** Projects named in a JSON request body: `projectId` itself, and the project of a `reportingPeriodId` or `indicatorId`. */
export function bodyScopes(body: unknown): ScopeLookup[] {
  if (!body || typeof body !== "object") return [];
  const b = body as Record<string, unknown>;
  const scopes: ScopeLookup[] = [];
  if (typeof b.projectId === "string" && b.projectId) scopes.push({ kind: "project", id: b.projectId });
  if (typeof b.reportingPeriodId === "string" && b.reportingPeriodId) scopes.push({ kind: "entity", entity: "reportingPeriod", id: b.reportingPeriodId });
  if (typeof b.indicatorId === "string" && b.indicatorId) scopes.push({ kind: "entity", entity: "indicator", id: b.indicatorId });
  return scopes;
}

/** Throws "not found" unless the person is on the project (administrators always are). Used by the middleware and by routes that read the project from a multipart body. */
export async function assertProjectAccess(req: FastifyRequest, projectId: string | undefined): Promise<void> {
  if (!projectId || req.tenant.role === "ADMIN") return;
  const prisma = req.container.prisma as unknown as Db;
  const tenantId = req.tenant.tenantId.toString();
  const userId = req.tenant.userId;
  const member = await prisma.projectMember.findFirst({ where: { tenantId, projectId, userId, status: "ACTIVE" }, select: { id: true } });
  if (member) return;
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId }, select: { projectManagerId: true, meOfficerId: true, reportingOfficerId: true } });
  if (!project) return; // not found: the handler answers
  if ([project.projectManagerId, project.meOfficerId, project.reportingOfficerId].includes(userId)) return;
  throw DomainError.notFound("Project", projectId);
}

export async function projectBoundaryMiddleware(req: FastifyRequest, _reply: FastifyReply) {
  if (req.tenant.role === "ADMIN") return;
  const scopes: ScopeLookup[] = [];
  const fromPath = projectScopeOf(req.url);
  if (fromPath) scopes.push(fromPath);
  scopes.push(...bodyScopes(req.body));
  const prisma = req.container.prisma as unknown as Db;
  for (const scope of scopes) {
    const projectId = await projectOf(prisma, scope);
    await assertProjectAccess(req, projectId ?? undefined);
  }
}
