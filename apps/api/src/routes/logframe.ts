import type { FastifyInstance } from "fastify";
import {
  CreateLogframeItemSchema,
  MoveLogframeItemSchema,
  ImportLogframeTextSchema,
  ImportIndicatorsTextSchema,
  CreateIndicatorSchema,
  UpdateIndicatorSemanticsSchema,
  UpdateIndicatorSchema,
  MoveIndicatorSchema,
  ConfirmIndicatorSemanticsSchema,
  VerifyPeriodIndicatorUpdatesSchema,
  CreateIndicatorUpdateSchema,
  BulkUpsertIndicatorUpdatesSchema,
  ParseIndicatorSheetSchema,
  IndicatorUpdateReviewReasonSchema,
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

  app.put("/v1/logframe-items/:id/position", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = MoveLogframeItemSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.moveLogframeItem.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return { ok: true };
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

  app.put("/v1/indicators/:id/semantics", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = UpdateIndicatorSemanticsSchema.parse({ ...(req.body as object), indicatorId: id });
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.updateIndicatorSemantics.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.patch("/v1/indicators/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = UpdateIndicatorSchema.parse({ ...(req.body as object), indicatorId: id });
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.updateIndicator.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/indicators/:id/move", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = MoveIndicatorSchema.parse({ ...(req.body as object), indicatorId: id });
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.moveIndicator.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/indicators/:id/archive", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.archiveIndicator.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:projectId/indicators/archived", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listArchivedIndicators.handle(ctx, projectId);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/indicators/:id/restore", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.restoreIndicator.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/indicators/semantics/confirm", async (req) => {
    const body = ConfirmIndicatorSemanticsSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.confirmIndicatorSemantics.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/reporting-periods/:id/indicator-updates/verify-all", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = VerifyPeriodIndicatorUpdatesSchema.parse({ ...((req.body as object | undefined) ?? {}), reportingPeriodId: id });
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.verifyPeriodIndicatorUpdates.handle(ctx, body);
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

  app.post("/v1/indicator-updates/:id/request-correction", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = IndicatorUpdateReviewReasonSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.requestIndicatorUpdateCorrection.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/indicator-updates/:id/reject", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = IndicatorUpdateReviewReasonSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.rejectIndicatorUpdate.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.get("/v1/indicators/:id/updates", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listIndicatorUpdates.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });
}
