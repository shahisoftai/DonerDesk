import type { FastifyInstance } from "fastify";
import { createContainer, type Container } from "@donordesk/infrastructure";
import { PresenceUpdateSchema, SubscribeCanvasSchema, CanvasDataWorkbookSchema, CanvasExportQuerySchema, CanvasSnapshotsSchema, CreateCanvasShareSchema, DraftCanvasTextSchema, PublishCanvasSchema, ReviewCanvasSchema, placeKeysOf, CanvasListQuerySchema, CanvasResolveQuerySchema, CreateCanvasSchema, PreviewCanvasSchema, SaveCanvasSchema } from "@donordesk/contracts";

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
    const r = await req.container.handlers.resolveCanvas.handle(ctx(req), idOf(req), { ...(q.periodId ? { periodId: q.periodId } : {}), placeKeys: placeKeysOf(q.places), ...(q.group ? { group: q.group } : {}), ...(q.status ? { status: q.status } : {}), ...(q.level ? { level: q.level } : {}), ...(q.indicator ? { indicator: q.indicator } : {}) });
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
  // The tables the person is looking at, as a spreadsheet. Nothing is read from the records: the sender already holds these figures.
  app.post("/v1/canvases/data-workbook", async (req, reply) => {
    const r = await req.container.handlers.buildDataWorkbook.handle(ctx(req), CanvasDataWorkbookSchema.parse(req.body));
    if (!r.ok) throw r.error;
    reply.header("content-type", r.value.contentType);
    reply.header("content-disposition", `attachment; filename="${r.value.fileName}"`);
    reply.header("cache-control", "private, no-store");
    return r.value.bytes;
  });
  // The caller's own email subscriptions: told weekly or monthly that a canvas is ready to open (a title and a link, never a figure).
  app.get("/v1/canvases/subscriptions", async (req) => {
    const r = await req.container.handlers.listMyCanvasSubscriptions.handle(ctx(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.put("/v1/canvases/:id/subscription", async (req) => {
    const r = await req.container.handlers.subscribeToCanvas.handle(ctx(req), idOf(req), SubscribeCanvasSchema.parse(req.body).every);
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.delete("/v1/canvases/:id/subscription", async (req) => {
    const r = await req.container.handlers.unsubscribeFromCanvas.handle(ctx(req), idOf(req));
    if (!r.ok) throw r.error;
    return { ok: true };
  });
  // Who else has this canvas open (Phase 48.8), as a stream of server-sent events. The stream carries names and what each person has selected,
  // never a figure or an edit; it ends when the page closes, and the person is gone from everyone else's list at once.
  app.get("/v1/canvases/:id/presence", async (req, reply) => {
    const r = await req.container.handlers.canvasPresence.open(ctx(req), idOf(req));
    if (!r.ok) throw r.error;
    const session = r.value;
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
    const send = () => { if (!raw.writableEnded) raw.write(`event: presence\ndata: ${JSON.stringify(session.others())}\n\n`); };
    const stop = session.subscribe(send);
    send();
    // A comment line now and then keeps proxies from closing a quiet stream, and refreshes this person's own entry.
    const beat = setInterval(() => { session.touch(); if (!raw.writableEnded) raw.write(": keep-alive\n\n"); }, 20_000);
    req.raw.on("close", () => { clearInterval(beat); stop(); session.close(); });
  });
  app.post("/v1/canvases/:id/presence", async (req) => {
    const body = PresenceUpdateSchema.parse(req.body);
    const r = await req.container.handlers.canvasPresence.update(ctx(req), idOf(req), body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
  app.post("/v1/canvases/preview", async (req) => {
    const { projectId, periodId, placeKeys, group, status, level, indicator, title, ...rest } = PreviewCanvasSchema.parse(req.body);
    const canvas = { id: "preview", title, scope: "MINE", mode: rest.mode ?? "LIVE", revision: 1, ...rest } as never;
    const r = await req.container.handlers.resolveCanvas.preview(ctx(req), { canvas, projectId, title }, { ...(periodId ? { periodId } : {}), ...(placeKeys?.length ? { placeKeys } : {}), ...(group ? { group } : {}), ...(status ? { status } : {}), ...(level ? { level } : {}), ...(indicator ? { indicator } : {}) });
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
