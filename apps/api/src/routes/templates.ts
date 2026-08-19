import type { FastifyInstance } from "fastify";
import { CreateDonorTemplateSchema, UpdateTemplateSectionsSchema } from "@donordesk/contracts";
import {
  buildLogframeTemplate,
  buildActivityTemplate,
  buildEvidenceTemplate,
  LOGFRAME_TEMPLATE_FILENAME,
  ACTIVITY_TEMPLATE_FILENAME,
  EVIDENCE_TEMPLATE_FILENAME,
} from "@donordesk/infrastructure";

export async function registerTemplateRoutes(app: FastifyInstance) {
  app.get("/api/templates/logframe", async (_req, reply) => {
    const buffer = await buildLogframeTemplate();
    reply.header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("content-disposition", `attachment; filename="${LOGFRAME_TEMPLATE_FILENAME}"`);
    return buffer;
  });

  app.get("/api/templates/activities", async (_req, reply) => {
    const buffer = await buildActivityTemplate();
    reply.header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("content-disposition", `attachment; filename="${ACTIVITY_TEMPLATE_FILENAME}"`);
    return buffer;
  });

  app.get("/api/templates/evidence", async (_req, reply) => {
    const buffer = await buildEvidenceTemplate();
    reply.header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("content-disposition", `attachment; filename="${EVIDENCE_TEMPLATE_FILENAME}"`);
    return buffer;
  });
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

  app.post("/v1/templates/parse-file", async (req) => {
    const data = await req.file();
    if (!data) throw new Error("file required");
    const buffer = await data.toBuffer();
    const result = await req.container.parser.parse({
      buffer,
      fileName: data.filename ?? "upload",
      fileType: data.mimetype ?? "application/octet-stream",
    });
    return { text: result.text, metadata: result.metadata };
  });

  app.put("/v1/templates/:id/sections", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = UpdateTemplateSectionsSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.updateTemplateSections.handle(ctx, id, body.sections);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.delete("/v1/templates/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.deleteTemplate.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
