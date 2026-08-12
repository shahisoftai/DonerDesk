import type { FastifyInstance } from "fastify";
import { CreateDonorTemplateSchema, UpdateTemplateSectionsSchema } from "@donordesk/contracts";

export async function registerTemplateRoutes(app: FastifyInstance) {
  app.get("/v1/projects/:projectId/templates", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listTemplates.handle(ctx, projectId);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/templates", async (req) => {
    const body = CreateDonorTemplateSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.uploadTemplate.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/templates/:id/sections", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = UpdateTemplateSectionsSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.updateTemplateSections.handle(ctx, id, body.sections);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
