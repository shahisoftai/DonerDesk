import type { FastifyInstance } from "fastify";
import { QueryVisualDataSchema, VisualDataCatalogueQuerySchema, VisualDataVersionQuerySchema } from "@donordesk/contracts";

/**
 * The Visual Studio's data (Phase 48.17). Thin: validate, call one handler, throw its error. Which projects and sources a person may
 * read is decided in the handlers; an outside partner has no route here (the route is not on the partner allow-list).
 */
export async function registerVisualDataRoutes(app: FastifyInstance) {
  const ctx = (req: { tenant: unknown; id: string }) => ({ tenant: req.tenant as never, requestId: req.id });

  app.get("/v1/visual-data/catalogue", async (req) => {
    const { search } = VisualDataCatalogueQuerySchema.parse(req.query);
    const r = req.container.handlers.getVisualDataCatalogue.handle(ctx(req), search);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/visual-data/query", async (req) => {
    const { projectId, query } = QueryVisualDataSchema.parse(req.body);
    const r = await req.container.handlers.queryVisualData.handle(ctx(req), projectId, query);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Cheap enough to ask every 30 seconds: only version numbers, for the projects named (comma-separated ids).
  app.get("/v1/visual-data/version", async (req) => {
    const { projects } = VisualDataVersionQuerySchema.parse(req.query);
    const r = await req.container.handlers.getVisualDataVersion.handle(ctx(req), projects.split(",").map((p) => p.trim()).filter(Boolean));
    if (!r.ok) throw r.error;
    return r.value;
  });
}
