import type { FastifyInstance } from "fastify";
import {
  CloneTemplateSchema,
  CreateDonorTemplateSchema,
  ReextractTemplateSchema,
  SetTemplateLibrarySchema,
  UpdateTemplateMetadataSchema,
  UpdateTemplateRequirementsSchema,
  UpdateTemplateSectionsSchema,
} from "@donordesk/contracts";
import { DomainError } from "@donordesk/domain";
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

  /** Parses an uploaded template with structure and stores the original file. */
  app.post("/v1/templates/parse-file", async (req) => {
    const data = await req.file();
    if (!data) throw DomainError.validation("A file is required");
    const buffer = await data.toBuffer();
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.parseTemplateFile.handle(ctx, {
      buffer,
      fileName: data.filename ?? "upload",
      mimeType: data.mimetype ?? "application/octet-stream",
    });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/templates/library", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listLibraryTemplates.handle(ctx);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.get("/v1/templates/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getTemplate.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/templates/:id/versions/:version", async (req) => {
    const { id, version } = req.params as { id: string; version: string };
    const n = Number(version);
    if (!Number.isInteger(n) || n < 1) throw DomainError.validation("Version must be a positive integer");
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getTemplateVersion.handle(ctx, id, n);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/templates/:id/original", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getTemplateOriginalFile.handle(ctx, id);
    if (!r.ok) throw r.error;
    reply.header("content-type", r.value.mimeType);
    reply.header("content-disposition", `attachment; filename="${r.value.fileName.replace(/"/g, "")}"`);
    return r.value.buffer;
  });

  app.get("/v1/templates/:id/brief-preview", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.previewTemplateBrief.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.patch("/v1/templates/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = UpdateTemplateMetadataSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.updateTemplateMetadata.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.put("/v1/templates/:id/sections", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = UpdateTemplateSectionsSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.updateTemplateSections.handle(ctx, id, body.sections, body.expectedVersion);
    if (!r.ok) throw r.error;
    return { ok: true, version: r.value.version };
  });

  app.put("/v1/templates/:id/requirements", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = UpdateTemplateRequirementsSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.updateTemplateRequirements.handle(ctx, id, body.requirements, body.expectedVersion);
    if (!r.ok) throw r.error;
    return { ok: true, version: r.value.version };
  });

  app.post("/v1/templates/:id/extract", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = ReextractTemplateSchema.parse(req.body ?? {});
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.reextractTemplate.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    reply.code(202);
    return r.value;
  });

  app.post("/v1/templates/:id/review", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.markTemplateReviewed.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/templates/:id/library", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = SetTemplateLibrarySchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.setTemplateLibrary.handle(ctx, id, body.isLibrary);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/templates/:id/clone", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = CloneTemplateSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.cloneTemplate.handle(ctx, id, body.projectId);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.delete("/v1/templates/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.deleteTemplate.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
