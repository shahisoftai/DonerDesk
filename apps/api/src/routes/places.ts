import type { FastifyInstance } from "fastify";
import { registerParseFileRoute } from "./parse-file.js";
import { createReadStream } from "node:fs";
import { z } from "zod";
import { AddPlaceFlowSchema, CreatePlaceSchema, ImportPlacesSchema, SeedPlacesFromBoundariesSchema, ListPlacesQuerySchema, ResolvePlacesSchema, SetPlaceGeometrySchema, UpdatePlaceSchema } from "@donordesk/contracts";

/** The organisation's list of places (Phase 33.1). Thin: validate, call one handler, throw its error; permissions are in the handlers and the authorization table. */
export async function registerPlaceRoutes(app: FastifyInstance) {
  registerParseFileRoute(app, "/v1/places/parse-file");
  const ctx = (req: { tenant: unknown; id: string }) => ({ tenant: req.tenant as never, requestId: req.id });
  const param = (req: { params: unknown }, name: string) => (req.params as Record<string, string>)[name]!;

  app.get("/v1/places", async (req) => {
    const query = ListPlacesQuerySchema.parse(req.query);
    const r = await req.container.handlers.listPlaces.handle(ctx(req), query);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/places", async (req, reply) => {
    const r = await req.container.handlers.createPlace.handle(ctx(req), CreatePlaceSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });

  app.put("/v1/places/:placeId", async (req) => {
    const r = await req.container.handlers.updatePlace.handle(ctx(req), param(req, "placeId"), UpdatePlaceSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/places/:placeId/archive", async (req) => {
    const r = await req.container.handlers.archivePlace.handle(ctx(req), param(req, "placeId"), true);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/places/:placeId/restore", async (req) => {
    const r = await req.container.handlers.archivePlace.handle(ctx(req), param(req, "placeId"), false);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // The outline or route of an area. The shape is checked by the domain (`validateGeometry`); the file lives in storage.
  app.get("/v1/places/:placeId/geometry", async (req) => {
    const r = await req.container.handlers.getPlaceGeometry.handle(ctx(req), param(req, "placeId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/places/:placeId/geometry", async (req) => {
    const r = await req.container.handlers.setPlaceGeometry.handle(ctx(req), param(req, "placeId"), SetPlaceGeometrySchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.delete("/v1/places/:placeId/geometry", async (req) => {
    const r = await req.container.handlers.clearPlaceGeometry.handle(ctx(req), param(req, "placeId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // `apply: false` previews and saves nothing.
  app.post("/v1/places/import", async (req) => {
    const r = await req.container.handlers.importPlaces.handle(ctx(req), ImportPlacesSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });

  // A country's places from its built-in boundaries (the browser sends the units); `apply: false` only counts.
  app.post("/v1/places/seed-boundaries", async (req) => {
    const r = await req.container.handlers.seedPlacesFromBoundaries.handle(ctx(req), SeedPlacesFromBoundariesSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Suggests what typed locations mean; never changes a record.
  app.post("/v1/places/resolve", async (req) => {
    const r = await req.container.handlers.resolvePlaces.handle(ctx(req), ResolvePlacesSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.get("/v1/places/unconfirmed", async (req) => {
    const r = await req.container.handlers.listUnconfirmedLocations.handle(ctx(req));
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Each indicator's recorded per-location values read at one level of the place tree (Data Center "By place").
  app.get("/v1/projects/:projectId/place-results", async (req) => {
    const { level, periodId } = z.object({ level: z.coerce.number().int().min(0).max(4).default(1), periodId: z.string().min(1).optional() }).parse(req.query);
    const r = await req.container.handlers.getProjectPlaceResults.handle(ctx(req), param(req, "projectId"), level as never, periodId ? { periodId } : {});
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Files other tools open (Phase 49.5): the places list as GeoJSON or CSV (the CSV is the places import's own columns), and one indicator's
  // results by place. Only what the person can already read; the handlers audit counts only.
  const Format = z.enum(["geojson", "csv"]).default("geojson");
  const send = (reply: { header(k: string, v: string): unknown; send(b: string): unknown }, file: { fileName: string; contentType: string; body: string; unpinned: number }) => {
    reply.header("content-type", file.contentType);
    reply.header("content-disposition", `attachment; filename="${file.fileName}"`);
    reply.header("x-unpinned", String(file.unpinned));
    reply.header("x-content-type-options", "nosniff");
    return reply.send(file.body);
  };
  app.get("/v1/places/export", async (req, reply) => {
    const { format } = z.object({ format: Format }).parse(req.query);
    const r = await req.container.handlers.exportPlaces.handle(ctx(req), format);
    if (!r.ok) throw r.error;
    return send(reply, r.value);
  });
  app.get("/v1/projects/:projectId/place-results/export", async (req, reply) => {
    const q = z.object({ format: Format, level: z.coerce.number().int().min(0).max(4).default(1), indicatorId: z.string().min(1), periodId: z.string().min(1).optional() }).parse(req.query);
    const r = await req.container.handlers.exportPlaceResults.handle(ctx(req), param(req, "projectId"), { level: q.level as never, indicatorId: q.indicatorId, format: q.format, ...(q.periodId ? { periodId: q.periodId } : {}) });
    if (!r.ok) throw r.error;
    return send(reply, r.value);
  });

  // The project's planned work as map points, grouped into counts per cell when there are many (Phase 49.4).
  app.get("/v1/projects/:projectId/map-points", async (req) => {
    const q = z.object({ bbox: z.string().regex(/^-?[\d.]+(,-?[\d.]+){3}$/), zoom: z.coerce.number().min(0).max(22) }).parse(req.query);
    const r = await req.container.handlers.getProjectMapPoints.handle(ctx(req), param(req, "projectId"), { bbox: q.bbox.split(",").map(Number), zoom: q.zoom });
    if (!r.ok) throw r.error;
    return r.value;
  });

  // A piece of the street map a phone keeps for working without a signal (Phase 49.4). `?check=1` answers the size first; then the file.
  app.get("/v1/projects/:projectId/offline-basemap", async (req, reply) => {
    const q = z.object({ bbox: z.string().regex(/^-?[\d.]+(,-?[\d.]+){3}$/), check: z.coerce.boolean().default(false) }).parse(req.query);
    const r = await req.container.handlers.getOfflineBasemap.handle(ctx(req), q.bbox.split(",").map(Number));
    if (!r.ok) throw r.error;
    if (q.check) return { bytes: r.value.bytes, maxzoom: r.value.maxzoom };
    reply.header("content-type", "application/octet-stream");
    reply.header("content-length", String(r.value.bytes));
    reply.header("cache-control", "private, no-store");
    return reply.send(createReadStream(r.value.path));
  });

  // Context layers and imagery for the organisation's maps (Phase 49.6). Reading is for every member; changing is an administrator's.
  app.get("/v1/organization/map-context", async (req) => {
    const r = await req.container.handlers.getMapContext.handle(ctx(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.put("/v1/organization/map-context", async (req) => {
    const body = z.object({ layers: z.array(z.string()).max(10).default([]), imageryUrl: z.string().max(500).nullable().default(null), imageryCredit: z.string().max(200).nullable().default(null) }).parse(req.body);
    const r = await req.container.handlers.updateMapContext.handle(ctx(req), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // The organisation's own facility types (Phase 50.3b). Reading is for every member; changing is an administrator's.
  app.get("/v1/organization/facility-types", async (req) => {
    const r = await req.container.handlers.getFacilityTypes.handle(ctx(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.put("/v1/organization/facility-types", async (req) => {
    const body = z.object({ types: z.array(z.object({ key: z.string().trim().min(1).max(40), label: z.string().trim().min(1).max(80), sector: z.string().max(40).optional() })).max(40) }).parse(req.body);
    const r = await req.container.handlers.saveFacilityTypes.handle(ctx(req), body);
    if (!r.ok) throw r.error;
    return { types: r.value };
  });

  // People living within rings around chosen points, from the population grid (Phase 49.7). Public population data only; nothing stored.
  app.post("/v1/projects/:projectId/analysis/population", async (req) => {
    const body = z.object({ rings: z.array(z.object({ lng: z.number().min(-180).max(180), lat: z.number().min(-90).max(90), km: z.number().min(0.1).max(100) })).min(1).max(50) }).parse(req.body);
    const r = await req.container.handlers.analysePopulation.handle(ctx(req), body.rings);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Movements between the project's places (Phase 48.12): what moved from one place to another, and how much.
  app.get("/v1/projects/:projectId/place-flows", async (req) => {
    const r = await req.container.handlers.listPlaceFlows.handle(ctx(req), param(req, "projectId"));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/projects/:projectId/place-flows", async (req, reply) => {
    const r = await req.container.handlers.addPlaceFlow.handle(ctx(req), param(req, "projectId"), AddPlaceFlowSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });
  app.delete("/v1/projects/:projectId/place-flows/:flowId", async (req) => {
    const r = await req.container.handlers.removePlaceFlow.handle(ctx(req), param(req, "projectId"), param(req, "flowId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
