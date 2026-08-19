import type { FastifyInstance } from "fastify";
import { CreateActivityUpdateSchema, PolishActivitySchema, ReviewActivitySchema, UpdateActivitySchema, AttachEvidenceSchema, DetachEvidenceSchema, ImportActivitiesTextSchema } from "@donordesk/contracts";
import { buildActivityTemplate, ACTIVITY_TEMPLATE_FILENAME } from "@donordesk/infrastructure";

export async function registerActivityRoutes(app: FastifyInstance) {
  app.get("/v1/activities/template", async (_req, reply) => {
    const buffer = await buildActivityTemplate();
    reply.header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("content-disposition", `attachment; filename="${ACTIVITY_TEMPLATE_FILENAME}"`);
    return buffer;
  });

  app.post("/v1/activities/import", async (req) => {
    const body = ImportActivitiesTextSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.importActivities.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/activities/parse-file", async (req) => {
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
  app.get("/v1/projects/:projectId/activities", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listActivities.handle(ctx, projectId);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.get("/v1/activities/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getActivity.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
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

  app.patch("/v1/activities/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = UpdateActivitySchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.updateActivity.handle(ctx, { ...body, activityId: id });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/activities/attach-evidence", async (req) => {
    const body = AttachEvidenceSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.attachEvidence.handle(ctx, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/activities/detach-evidence", async (req) => {
    const body = DetachEvidenceSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.detachEvidence.handle(ctx, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
