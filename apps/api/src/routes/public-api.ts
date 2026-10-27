import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { createContainer, type Container } from "@donordesk/infrastructure";
import type { ApiScope } from "@donordesk/domain";

/**
 * The public, read-only API (Phase 33.7): `/api/v1/*`, called with `Authorization: Bearer dd_live_…`. It has its own
 * authentication (an API key, resolved on the admin connection because the caller does not yet know its organisation)
 * and sits in its own encapsulated scope, so it never passes through the session middleware and a session never opens
 * it. A key may read only the scopes it was given and only its own projects. Every answer is a fixed, small shape.
 * Refusals say only "not allowed" — never which of the possible reasons applied.
 */
export async function registerPublicApiRoutes(app: FastifyInstance, admin: Container) {
  await app.register(async (api) => {
    const run = async (req: FastifyRequest, reply: { status(n: number): { send(b: unknown): unknown } }, need: { scope: ApiScope; projectId?: string }) => {
      const auth = await admin.apiKeyAuth.authenticate(req.headers.authorization, need);
      if (!auth.ok) {
        req.log.info({ reason: auth.reason }, "api key refused");
        reply.status(auth.status).send({ type: "https://donordesk/problems/" + (auth.status === 401 ? "unauthorized" : "forbidden"), title: auth.status === 401 ? "A valid API key is required" : "This key may not do that", status: auth.status });
        return null;
      }
      const container = createContainer({ tenantId: auth.principal.tenantId.toString() });
      // A key is a read-only guest: never an administrator, never a member, so nothing else it could reach would answer.
      const ctx = { tenant: { tenantId: auth.principal.tenantId, userId: `api-key:${auth.principal.keyId}`, role: "VIEWER" as const, external: true }, requestId: req.id };
      return { container, ctx, principal: auth.principal };
    };

    api.get("/api/v1/projects", async (req, reply) => {
      const a = await run(req, reply as never, { scope: "projects:read" });
      if (!a) return;
      const r = await a.container.handlers.listApiProjects.handle(a.principal.tenantId, a.principal.projectIds);
      if (!r.ok) throw r.error;
      return { projects: r.value };
    });

    api.get("/api/v1/projects/:projectId/indicators", async (req, reply) => {
      const projectId = (req.params as { projectId: string }).projectId;
      const a = await run(req, reply as never, { scope: "indicators:read", projectId });
      if (!a) return;
      const r = await a.container.handlers.getProjectDataSheet.handle(a.ctx as never, projectId);
      if (!r.ok) throw r.error;
      // Indicator values by period; the finance block is not part of this scope.
      const { finance: _finance, financeEnabled: _enabled, ...sheet } = r.value as unknown as Record<string, unknown>;
      return sheet;
    });

    api.get("/api/v1/projects/:projectId/place-results", async (req, reply) => {
      const projectId = (req.params as { projectId: string }).projectId;
      const a = await run(req, reply as never, { scope: "places:read", projectId });
      if (!a) return;
      const { level } = z.object({ level: z.coerce.number().int().min(0).max(4).default(1) }).parse(req.query);
      const r = await a.container.handlers.getProjectPlaceResults.handle(a.ctx as never, projectId, level as never);
      if (!r.ok) throw r.error;
      return r.value;
    });
  });
}
