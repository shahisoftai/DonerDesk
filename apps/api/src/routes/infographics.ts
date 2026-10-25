import type { FastifyInstance } from "fastify";
import { CreateInfographicSchema, UpdateInfographicSchema, ExportInfographicSchema } from "@donordesk/contracts";

/**
 * Infographic Studio routes (Phase 31). Thin: validate with Zod, call one handler, throw its error.
 * Reads are `project.view`; writes are `report.edit`; publishing a rendering is `report.export` —
 * the authorization table owns every rule. Create honours the global `Idempotency-Key` hook.
 */
export async function registerInfographicsRoutes(app: FastifyInstance) {
  const idOf = (req: { params: unknown }, name: string) => (req.params as Record<string, string>)[name]!;

  // The one enriched read the Studio composes from (periods, indicators with location views,
  // beneficiary reach, activities by location, verified finance).
  app.get("/v1/projects/:projectId/infographic-data", async (req) => {
    const r = await req.container.handlers.getProjectInfographicData.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:projectId/infographics", async (req) => {
    const r = await req.container.handlers.listProjectInfographics.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"));
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/projects/:projectId/infographics", async (req) => {
    const body = CreateInfographicSchema.parse(req.body);
    const r = await req.container.handlers.createInfographic.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/infographics/:infographicId", async (req) => {
    const r = await req.container.handlers.getInfographic.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "infographicId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/infographics/:infographicId", async (req) => {
    const body = UpdateInfographicSchema.parse(req.body);
    const r = await req.container.handlers.updateInfographic.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "infographicId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.delete("/v1/infographics/:infographicId", async (req) => {
    const confirm = (req.query as { confirm?: string }).confirm === "true";
    const r = await req.container.handlers.deleteInfographic.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "infographicId"), { confirm });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/infographics/:infographicId/exports", async (req) => {
    const r = await req.container.handlers.listInfographicExports.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "infographicId"));
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/infographics/:infographicId/exports", async (req) => {
    const body = ExportInfographicSchema.parse(req.body);
    const r = await req.container.handlers.exportInfographic.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "infographicId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/infographics/:infographicId/exports/:exportId/file", async (req, reply) => {
    const r = await req.container.handlers.getInfographicExportFile.handle(
      { tenant: req.tenant, requestId: req.id },
      idOf(req, "infographicId"),
      idOf(req, "exportId"),
    );
    if (!r.ok) throw r.error;
    reply.header("content-type", r.value.contentType);
    reply.header("content-disposition", `attachment; filename="infographic-${idOf(req, "exportId")}.${r.value.format.toLowerCase()}"`);
    return r.value.bytes;
  });
}
