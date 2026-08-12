import type { FastifyInstance } from "fastify";
import { CreateExportSchema } from "@donordesk/contracts";

export async function registerExportRoutes(app: FastifyInstance) {
  app.post("/v1/exports", async (req) => {
    const body = CreateExportSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.createExport.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:id/exports", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.exports.findByProject(id, req.tenant.tenantId);
    if (!r.ok) throw r.error;
    return { items: r.value.map((e) => ({ id: e.id, exportType: e.exportType, fileUrl: e.fileUrl, createdAt: e.createdAt })) };
  });
}
