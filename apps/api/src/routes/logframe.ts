import type { FastifyInstance } from "fastify";
import {
  CreateLogframeItemSchema,
  ImportLogframeTextSchema,
  ImportIndicatorsTextSchema,
  CreateIndicatorSchema,
  CreateIndicatorUpdateSchema,
  BulkUpsertIndicatorUpdatesSchema,
  ParseIndicatorSheetSchema,
} from "@donordesk/contracts";
import { buildLogframeTemplate, LOGFRAME_TEMPLATE_FILENAME } from "@donordesk/infrastructure";

export async function registerLogframeRoutes(app: FastifyInstance) {
  app.get("/v1/logframe/template", async (_req, reply) => {
    const buffer = await buildLogframeTemplate();
    reply.header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("content-disposition", `attachment; filename="${LOGFRAME_TEMPLATE_FILENAME}"`);
    return buffer;
  });
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

  app.post("/v1/logframe/import", async (req) => {
    const body = ImportLogframeTextSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.importLogframe.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/logframe/indicators/import", async (req) => {
    const body = ImportIndicatorsTextSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.importIndicators.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/logframe/parse-file", async (req) => {
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

  app.post("/v1/indicators", async (req) => {
    const body = CreateIndicatorSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.createIndicator.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/indicators/parse-file", async (req) => {
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

  app.post("/v1/indicator-updates", async (req) => {
    const body = CreateIndicatorUpdateSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.createIndicatorUpdate.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/indicator-updates/bulk", async (req) => {
    const body = BulkUpsertIndicatorUpdatesSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.bulkUpsertIndicatorUpdates.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/indicator-updates/parse-sheet", async (req) => {
    const body = ParseIndicatorSheetSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.parseIndicatorSheet.handle(ctx, body);
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
