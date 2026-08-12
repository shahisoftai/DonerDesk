import type { FastifyInstance } from "fastify";
import { CreateCommentSchema } from "@donordesk/contracts";

export async function registerCommentRoutes(app: FastifyInstance) {
  app.post("/v1/comments", async (req) => {
    const body = CreateCommentSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.addComment.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/comments/:id/resolve", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.resolveComment.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.get("/v1/comments", async (req) => {
    const q = req.query as { entityType?: string; entityId?: string };
    if (!q.entityType || !q.entityId) return { items: [] };
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listComments.handle(ctx, q.entityType, q.entityId);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });
}
