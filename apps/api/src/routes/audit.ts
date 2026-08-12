import type { FastifyInstance } from "fastify";

export async function registerAuditRoutes(app: FastifyInstance) {
  app.get("/v1/audit-log", async (req) => {
    const q = req.query as { projectId?: string; limit?: string; offset?: string };
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listAuditLog.handle(
      ctx,
      q.projectId,
      q.limit ? Number(q.limit) : 100,
      q.offset ? Number(q.offset) : 0,
    );
    if (!r.ok) throw r.error;
    return { items: r.value };
  });
}
