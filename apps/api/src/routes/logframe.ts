import type { FastifyInstance } from "fastify";
import { CreateLogframeItemSchema, CreateIndicatorSchema, CreateIndicatorUpdateSchema } from "@donordesk/contracts";

export async function registerLogframeRoutes(app: FastifyInstance) {
  app.get("/v1/projects/:projectId/logframe", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listLogframe.handle(ctx, projectId);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/logframe-items", async (req) => {
    const body = CreateLogframeItemSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.createLogframeItem.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/indicators", async (req) => {
    const body = CreateIndicatorSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.createIndicator.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/indicator-updates", async (req) => {
    const body = CreateIndicatorUpdateSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.createIndicatorUpdate.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/indicator-updates/:id/verify", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.verifyIndicatorUpdate.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
