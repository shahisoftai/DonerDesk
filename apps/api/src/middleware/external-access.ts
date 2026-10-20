import type { FastifyReply, FastifyRequest } from "fastify";
import { DomainError } from "@donordesk/domain";

/**
 * An outside implementing partner (a user flagged `external`) is not a member of the organisation. They reach the projects
 * they were given (project membership, enforced by `project-boundary`) and, within those, only the routes below: read the
 * project and its framework, report activities, upload evidence, enter indicator values. Everything else — the user
 * directory, billing, funding, exports, audit, comments, report editing, other projects — is refused, so a route added
 * tomorrow is closed to partners until someone lists it here.
 */
export const EXTERNAL_ALLOWED: ReadonlyArray<{ method: string; route: RegExp }> = [
  { method: "GET", route: /^\/v1\/projects$/ },
  { method: "GET", route: /^\/v1\/projects\/[^/]+$/ },
  { method: "GET", route: /^\/v1\/projects\/[^/]+\/(logframe|activities|reporting-periods)$/ },
  { method: "GET", route: /^\/v1\/organization$/ },
  { method: "GET", route: /^\/v1\/(notifications|me\/week|legal\/consent)$/ },
  { method: "POST", route: /^\/v1\/(legal\/consent|notifications\/[^/]+\/read)$/ },
  { method: "POST", route: /^\/v1\/activities$/ },
  { method: "GET", route: /^\/v1\/activities\/[^/]+$/ },
  { method: "POST", route: /^\/v1\/evidence\/upload$/ },
  { method: "GET", route: /^\/v1\/evidence\/[^/]+$/ },
  { method: "GET", route: /^\/v1\/files\/[^/]+$/ },
  { method: "GET", route: /^\/v1\/reporting-periods\/[^/]+\/indicators$/ },
  { method: "POST", route: /^\/v1\/indicator-updates(\/bulk)?$/ },
];

export function isExternalAllowed(method: string, path: string): boolean {
  const m = method === "HEAD" ? "GET" : method;
  return EXTERNAL_ALLOWED.some((rule) => rule.method === m && rule.route.test(path));
}

export async function externalAccessMiddleware(req: FastifyRequest, _reply: FastifyReply) {
  if (!req.tenant.external) return;
  const path = req.url.split("?", 1)[0] ?? req.url;
  if (!isExternalAllowed(req.method, path)) {
    throw DomainError.forbidden("Your account is for the projects you were given. This page is not part of it.");
  }
  // A file is reachable only when it belongs to one of the person's projects (the by-id routes are checked by project-boundary).
  const file = /^\/v1\/files\/([^/]+)$/.exec(path);
  if (file) {
    const prisma = req.container.prisma;
    const key = decodeURIComponent(file[1] as string);
    const evidence = await prisma.evidenceFile.findFirst({ where: { OR: [{ storageKey: key }, { fileUrl: { endsWith: `/${file[1]}` } }] }, select: { projectId: true } });
    const allowed = evidence
      ? await prisma.projectMember.findFirst({ where: { tenantId: req.tenant.tenantId.toString(), projectId: evidence.projectId, userId: req.tenant.userId, status: "ACTIVE" }, select: { id: true } })
      : null;
    if (!allowed) throw DomainError.notFound("File", key);
  }
}
