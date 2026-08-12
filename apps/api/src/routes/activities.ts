import type { FastifyInstance } from "fastify";
import { CreateActivityUpdateSchema, PolishActivitySchema, ReviewActivitySchema } from "@donordesk/contracts";

export async function registerActivityRoutes(app: FastifyInstance) {
  app.get("/v1/projects/:projectId/activities", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listActivities.handle(ctx, projectId);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/activities", async (req) => {
    const body = CreateActivityUpdateSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.createActivityUpdate.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/activities/polish", async (req) => {
    const body = PolishActivitySchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.polishActivity.handle(ctx, body.activityId);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/activities/review", async (req) => {
    const body = ReviewActivitySchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.reviewActivity.handle(ctx, body.activityId, { decision: body.decision, notes: body.notes });
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
