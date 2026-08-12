import type { FastifyInstance } from "fastify";
import { CreateProjectSchema, UpdateProjectSchema } from "@donordesk/contracts";

export async function registerProjectRoutes(app: FastifyInstance) {
  app.get("/v1/projects", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listProjects.handle(ctx);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/projects", async (req) => {
    const body = CreateProjectSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.createProject.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getProject.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/projects/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = UpdateProjectSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.updateProject.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
