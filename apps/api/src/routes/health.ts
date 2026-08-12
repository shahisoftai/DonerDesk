import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { metrics } from "../observability.js";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (_req, reply) => {
    try {
      await app.container.prisma.$queryRaw`SELECT 1`;
      return { status: "ready", checks: { database: "ok" } };
    } catch {
      return reply.status(503).send({ status: "not_ready", checks: { database: "failed" } });
    }
  });
  app.get("/metrics", async (_req, reply) => {
    reply.type("text/plain; version=0.0.4");
    return metrics.metrics();
  });
  app.get("/v1/ping", { preHandler: authMiddleware }, async (req, reply) => {
    const tenantId = req.tenant.tenantId.toString();
    reply.header("x-tenant-id", tenantId);
    return { pong: true, service: "donordesk-api", tenantId, ts: new Date().toISOString() };
  });
}
