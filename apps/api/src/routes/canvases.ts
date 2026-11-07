import type { FastifyInstance } from "fastify";
import { createContainer, type Container } from "@donordesk/infrastructure";
import { CanvasExportQuerySchema, CanvasSnapshotsSchema, CreateCanvasShareSchema, DraftCanvasTextSchema, PublishCanvasSchema, ReviewCanvasSchema, placeKeysOf, CanvasListQuerySchema, CanvasResolveQuerySchema, CreateCanvasSchema, PreviewCanvasSchema, SaveCanvasSchema } from "@donordesk/contracts";

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
    const q = CanvasResolveQuerySchema.parse(req.query);
    const r = await req.container.handlers.resolveCanvas.handle(ctx(req), idOf(req), { ...(q.periodId ? { periodId: q.periodId } : {}), placeKeys: placeKeysOf(q.places) });
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
    const { projectId, periodId, placeKeys, title, ...rest } = PreviewCanvasSchema.parse(req.body);
    const canvas = { id: "preview", title, scope: "MINE", mode: rest.mode ?? "LIVE", revision: 1, ...rest } as never;
    const r = await req.container.handlers.resolveCanvas.preview(ctx(req), { canvas, projectId, title }, { ...(periodId ? { periodId } : {}), ...(placeKeys?.length ? { placeKeys } : {}) });
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

  // ---- publishing: saved copies, share links, review, history, snapshots, drafting
  const text = (value: string): string => value;
  app.post("/v1/canvases/:id/publish", async (req, reply) => {
    const body = PublishCanvasSchema.parse(req.body);
    const r = await req.container.handlers.publishCanvas.handle(ctx(req), idOf(req), { format: body.format, ...(body.scale ? { scale: body.scale as 1 | 2 | 3 } : {}) });
    if (!r.ok) throw r.error;
    return reply.code(201).send(r.value);
  });
  app.get("/v1/canvases/:id/exports", async (req) => {
    const r = await req.container.handlers.listCanvasExports.handle(ctx(req), idOf(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.get("/v1/canvases/:id/exports/:exportId/file", async (req, reply) => {
    const r = await req.container.handlers.getCanvasExportFile.handle(ctx(req), idOf(req), (req.params as { exportId: string }).exportId);
    if (!r.ok) throw r.error;
    reply.header("content-type", r.value.contentType);
    reply.header("content-disposition", `attachment; filename="${text(r.value.fileName)}"`);
    reply.header("cache-control", "private, no-store");
    return r.value.bytes;
  });
  app.post("/v1/canvases/:id/shares", async (req, reply) => {
    const r = await req.container.handlers.createCanvasShare.handle(ctx(req), idOf(req), CreateCanvasShareSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.code(201).send(r.value);
  });
  app.get("/v1/canvases/:id/shares", async (req) => {
    const r = await req.container.handlers.listCanvasShares.handle(ctx(req), idOf(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.delete("/v1/canvases/:id/shares/:linkId", async (req) => {
    const r = await req.container.handlers.revokeCanvasShare.handle(ctx(req), idOf(req), (req.params as { linkId: string }).linkId);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
  app.post("/v1/canvases/:id/review", async (req) => {
    const r = await req.container.handlers.reviewCanvas.handle(ctx(req), idOf(req), ReviewCanvasSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.get("/v1/canvases/:id/versions", async (req) => {
    const r = await req.container.handlers.listCanvasVersions.list(ctx(req), idOf(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.get("/v1/canvases/:id/versions/:revision", async (req) => {
    const r = await req.container.handlers.listCanvasVersions.get(ctx(req), idOf(req), Number((req.params as { revision: string }).revision));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.put("/v1/canvases/:id/snapshots", async (req) => {
    const r = await req.container.handlers.setCanvasSnapshots.handle(ctx(req), idOf(req), CanvasSnapshotsSchema.parse(req.body).every);
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/canvases/draft-text", async (req) => {
    const r = await req.container.handlers.draftCanvasText.handle(ctx(req), DraftCanvasTextSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });
}

/**
 * Public links to a canvas (no session). A LIVE link draws the canvas now as an outside guest; a FROZEN link serves one published copy.
 * Every unusable link (unknown, expired, revoked) answers the same 404, and nothing is cached by shared caches.
 */
export async function registerPublicCanvasRoutes(app: FastifyInstance, admin: Container) {
  const resolve = async (token: string) => {
    const link = await admin.resolveCanvasShare.handle(token);
    return link.ok ? { link: link.value, tenant: createContainer({ tenantId: link.value.tenantId.toString() }) } : null;
  };
  app.get("/public/canvases/:token", async (req, reply) => {
    reply.header("cache-control", "private, no-store");
    reply.header("x-robots-tag", "noindex, nofollow");
    const found = await resolve((req.params as { token: string }).token);
    if (!found) { reply.code(404); return { title: "This link is not available" }; }
    if (found.link.kind === "FROZEN") return { kind: "FROZEN", title: "A published copy" };
    const r = await found.tenant.handlers.publicCanvas.handle(found.link.tenantId, found.link.canvasId);
    if (!r.ok) { reply.code(404); return { title: "This link is not available" }; }
    return { kind: "LIVE", ...r.value };
  });
  app.get("/public/canvases/:token/file", async (req, reply) => {
    reply.header("cache-control", "private, no-store");
    reply.header("x-robots-tag", "noindex, nofollow");
    reply.header("x-content-type-options", "nosniff");
    const found = await resolve((req.params as { token: string }).token);
    if (!found || found.link.kind !== "FROZEN" || !found.link.exportId) { reply.code(404); return { title: "This link is not available" }; }
    const r = await found.tenant.handlers.getCanvasShareFile.handle(found.link.tenantId, found.link.canvasId, found.link.exportId);
    if (!r.ok) { reply.code(404); return { title: "This link is not available" }; }
    reply.header("content-type", r.value.contentType);
    reply.header("content-disposition", `inline; filename="${r.value.fileName}"`);
    return r.value.bytes;
  });
}
