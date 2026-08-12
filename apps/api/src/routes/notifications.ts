import type { FastifyInstance } from "fastify";

export async function registerNotificationRoutes(app: FastifyInstance) {
  app.get("/v1/notifications", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listNotifications.handle(ctx);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/notifications/:id/read", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.markNotificationRead.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
