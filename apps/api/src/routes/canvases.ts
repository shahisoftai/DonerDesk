import type { FastifyInstance } from "fastify";
import { CanvasExportQuerySchema, CanvasListQuerySchema, CanvasResolveQuerySchema, CreateCanvasSchema, PreviewCanvasSchema, SaveCanvasSchema } from "@donordesk/contracts";

/** Canvases (Phase 45): the merged dashboards and infographics. Thin: validate, call one handler, throw its error. The handlers apply who may see and change which canvas. */
export async function registerCanvasRoutes(app: FastifyInstance) {
  const ctx = (req: { tenant: unknown; id: string }) => ({ tenant: req.tenant as never, requestId: req.id });
  const idOf = (req: { params: unknown }) => (req.params as { id: string }).id;

  app.get("/v1/canvases", async (req) => {
    const r = await req.container.handlers.listCanvases.handle(ctx(req), CanvasListQuerySchema.parse(req.query).projectId);
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/canvases", async (req, reply) => {
    const r = await req.container.handlers.createCanvas.handle(ctx(req), CreateCanvasSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.code(201).send(r.value);
  });
  app.get("/v1/canvases/:id", async (req) => {
    const r = await req.container.handlers.getCanvas.handle(ctx(req), idOf(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.put("/v1/canvases/:id", async (req) => {
    const r = await req.container.handlers.saveCanvas.handle(ctx(req), { id: idOf(req), ...SaveCanvasSchema.parse(req.body) });
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.delete("/v1/canvases/:id", async (req) => {
    const r = await req.container.handlers.deleteCanvas.handle(ctx(req), idOf(req));
    if (!r.ok) throw r.error;
    return { ok: true };
  });
  app.post("/v1/canvases/:id/duplicate", async (req, reply) => {
    const r = await req.container.handlers.duplicateCanvas.handle(ctx(req), idOf(req));
    if (!r.ok) throw r.error;
    return reply.code(201).send(r.value);
  });
  app.get("/v1/canvases/:id/resolve", async (req) => {
    const r = await req.container.handlers.resolveCanvas.handle(ctx(req), idOf(req), CanvasResolveQuerySchema.parse(req.query));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.get("/v1/canvases/:id/export", async (req, reply) => {
    const q = CanvasExportQuerySchema.parse(req.query);
    const r = await req.container.handlers.exportCanvas.handle(ctx(req), idOf(req), { format: q.format, ...(q.scale ? { scale: q.scale as 1 | 2 | 3 } : {}) });
    if (!r.ok) throw r.error;
    reply.header("content-type", r.value.contentType);
    reply.header("content-disposition", `attachment; filename="${r.value.fileName}"`);
    reply.header("x-canvas-skipped", encodeURIComponent(JSON.stringify(r.value.skipped.map((s) => ({ kind: s.kind, reason: s.reason })))));
    reply.header("cache-control", "private, no-store");
    return r.value.bytes;
  });
  app.post("/v1/canvases/preview", async (req) => {
    const { projectId, periodId, title, ...rest } = PreviewCanvasSchema.parse(req.body);
    const canvas = { id: "preview", title, scope: "MINE", mode: rest.mode ?? "LIVE", revision: 1, ...rest } as never;
    const r = await req.container.handlers.resolveCanvas.preview(ctx(req), { canvas, projectId, title }, periodId ? { periodId } : {});
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/canvases/from-dashboard/:id", async (req) => {
    const r = await req.container.handlers.convertDashboard.handle(ctx(req), idOf(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/canvases/from-infographic/:id", async (req) => {
    const r = await req.container.handlers.convertInfographic.handle(ctx(req), idOf(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
}
