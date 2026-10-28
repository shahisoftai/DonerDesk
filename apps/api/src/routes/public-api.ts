import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { createContainer, type Container } from "@donordesk/infrastructure";
import { RateWindow, type ApiScope } from "@donordesk/domain";
import { handleMcpPayload, type McpHost } from "@donordesk/application";

/**
 * The public, read-only API (Phase 33.7): `/api/v1/*`, called with `Authorization: Bearer dd_live_…`. It has its own
 * authentication (an API key, resolved on the admin connection because the caller does not yet know its organisation)
 * and sits in its own encapsulated scope, so it never passes through the session middleware and a session never opens
 * it. A key may read only the scopes it was given and only its own projects. Every answer is a fixed, small shape.
 * Refusals say only "not allowed" — never which of the possible reasons applied.
 */
// A key may make this many requests a minute (the proxy in front also limits bursts). In memory: the API is one process, and a restart
// only gives a key a fresh minute.
const perMinute = Math.max(10, Number(process.env.API_KEY_REQUESTS_PER_MINUTE ?? 120) || 120);
const limiter = new RateWindow(perMinute, 60_000);

export async function registerPublicApiRoutes(app: FastifyInstance, admin: Container) {
  await app.register(async (api) => {
    const run = async (req: FastifyRequest, reply: { status(n: number): { send(b: unknown): unknown } }, need: { scope: ApiScope; projectId?: string }) => {
      const auth = await admin.apiKeyAuth.authenticate(req.headers.authorization, need);
      if (!auth.ok) {
        req.log.info({ reason: auth.reason }, "api key refused");
        reply.status(auth.status).send({ type: "https://donordesk/problems/" + (auth.status === 401 ? "unauthorized" : "forbidden"), title: auth.status === 401 ? "A valid API key is required" : "This key may not do that", status: auth.status });
        return null;
      }
      const decision = limiter.hit(auth.principal.keyId, Date.now());
      if (!decision.ok) {
        (reply as unknown as { header(k: string, v: string): unknown }).header("retry-after", String(decision.retryAfterSeconds));
        reply.status(429).send({ type: "https://donordesk/problems/rate-limited", title: "Too many requests; slow down", status: 429 });
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

    // The same read-only API as tools for an AI assistant (Model Context Protocol, JSON-RPC over POST). Same keys, scopes and project limits.
    api.get("/api/v1/mcp", async (_req, reply) => reply.status(405).header("allow", "POST").send({ title: "Send MCP messages with POST", status: 405 }));
    api.post("/api/v1/mcp", async (req, reply) => {
      const who = await admin.apiKeyAuth.identify(req.headers.authorization);
      if (!who.ok) return reply.status(401).send({ type: "https://donordesk/problems/unauthorized", title: "A valid API key is required", status: 401 });
      const decision = limiter.hit(who.principal.keyId, Date.now());
      if (!decision.ok) return reply.header("retry-after", String(decision.retryAfterSeconds)).status(429).send({ type: "https://donordesk/problems/rate-limited", title: "Too many requests; slow down", status: 429 });
      const container = createContainer({ tenantId: who.principal.tenantId.toString() });
      const ctx = { tenant: { tenantId: who.principal.tenantId, userId: `api-key:${who.principal.keyId}`, role: "VIEWER" as const, external: true }, requestId: req.id };
      const host: McpHost = {
        scopes: who.principal.scopes as ApiScope[],
        call: async (tool, args) => {
          const projectId = tool.needsProject ? String(args.projectId) : undefined;
          // Every call is checked again against the key: its scope and, for a project tool, that project.
          const auth = await admin.apiKeyAuth.authenticate(req.headers.authorization, { scope: tool.scope, ...(projectId ? { projectId } : {}) });
          if (!auth.ok) return { ok: false, message: "This key may not do that." };
          if (tool.name === "list_projects") {
            const r = await container.handlers.listApiProjects.handle(auth.principal.tenantId, auth.principal.projectIds);
            return r.ok ? { ok: true, data: { projects: r.value } } : { ok: false, message: "That could not be answered right now." };
          }
          if (tool.name === "get_indicator_values") {
            const r = await container.handlers.getProjectDataSheet.handle(ctx as never, projectId!);
            if (!r.ok) return { ok: false, message: "That project was not found." };
            const sheet = r.value as unknown as { indicators: Array<Record<string, unknown>>; periods: Array<Record<string, unknown>>; cells: Array<Record<string, unknown>> };
            const code = new Map(sheet.indicators.map((i) => [i.id, i.code]));
            const label = new Map(sheet.periods.map((p) => [p.id, p.label]));
            return {
              ok: true,
              data: {
                indicators: sheet.indicators.map((i) => ({ code: i.code, name: i.name, unit: i.unit, baseline: i.baseline, target: i.target })),
                periods: sheet.periods.map((p) => ({ label: p.label, start: p.start, end: p.end })),
                values: sheet.cells.filter((c) => c.periodValue !== "" || c.cumulativeValue !== "").map((c) => ({ indicator: code.get(c.indicatorId), period: label.get(c.periodId), periodValue: c.periodValue, cumulativeValue: c.cumulativeValue, status: c.status })),
              },
            };
          }
          const level = Number.isInteger(args.level) && (args.level as number) >= 0 && (args.level as number) <= 4 ? (args.level as number) : 1;
          const r = await container.handlers.getProjectPlaceResults.handle(ctx as never, projectId!, level as never);
          return r.ok ? { ok: true, data: r.value } : { ok: false, message: "That project was not found." };
        },
      };
      const answer = await handleMcpPayload(req.body, host);
      return answer === null ? reply.status(202).send() : reply.send(answer);
    });
  });
}
