import type { FastifyInstance } from "fastify";
import {
  AddPlaceInlineSchema, ConfirmPlaceWordSchema, MergePlacesSchema, RecordPlaceKindSchema, SetIndicatorPlacesSchema, SetProjectAreaOpenSchema,
  SetRecordPlacesSchema, TickProjectAreaSchema, WhereWeWorkQuerySchema,
} from "@donordesk/contracts";

/** One place tree (Phase 56): a project's footprint, record places, typed words, the organisation's map, merges. Thin: validate, one handler, throw its error. */
export async function registerPlaceTreeRoutes(app: FastifyInstance) {
  const ctx = (req: { tenant: unknown; id: string }) => ({ tenant: req.tenant as never, requestId: req.id });
  const param = (req: { params: unknown }, name: string) => (req.params as Record<string, string>)[name]!;

  app.get("/v1/projects/:id/places", async (req) => {
    const r = await req.container.handlers.listProjectPlaces.handle(ctx(req), param(req, "id"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/projects/:id/areas", async (req, reply) => {
    const r = await req.container.handlers.tickProjectArea.handle(ctx(req), param(req, "id"), TickProjectAreaSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });

  // Refused while the project's records sit in the area (409-style validation naming them); closing is the alternative.
  app.delete("/v1/projects/:id/areas/:placeId", async (req) => {
    const r = await req.container.handlers.untickProjectArea.handle(ctx(req), param(req, "id"), param(req, "placeId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.put("/v1/projects/:id/areas/:placeId/open", async (req) => {
    const r = await req.container.handlers.setProjectAreaOpen.handle(ctx(req), param(req, "id"), param(req, "placeId"), SetProjectAreaOpenSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.get("/v1/projects/:id/record-places/:kind/:recordId", async (req) => {
    const r = await req.container.handlers.getRecordPlaces.handle(ctx(req), param(req, "id"), RecordPlaceKindSchema.parse(param(req, "kind")), param(req, "recordId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/projects/:id/record-places/:kind/:recordId", async (req) => {
    const r = await req.container.handlers.setRecordPlaces.handle(ctx(req), param(req, "id"), RecordPlaceKindSchema.parse(param(req, "kind")), param(req, "recordId"), SetRecordPlacesSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/projects/:id/place-words/confirm", async (req) => {
    const r = await req.container.handlers.confirmPlaceWord.handle(ctx(req), param(req, "id"), ConfirmPlaceWordSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/projects/:id/places/inline", async (req, reply) => {
    const r = await req.container.handlers.addPlaceInline.handle(ctx(req), param(req, "id"), AddPlaceInlineSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(r.value.existed ? 200 : 201).send(r.value);
  });

  app.get("/v1/where-we-work", async (req) => {
    const r = await req.container.handlers.getWhereWeWork.handle(ctx(req), WhereWeWorkQuerySchema.parse(req.query));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/places/:placeId/profile", async (req) => {
    const r = await req.container.handlers.getPlaceProfile.handle(ctx(req), param(req, "placeId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/places/duplicates", async (req) => {
    const r = await req.container.handlers.listDuplicatePlaces.handle(ctx(req));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/places/merge", async (req) => {
    const r = await req.container.handlers.mergePlaces.handle(ctx(req), MergePlacesSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/indicators/:indicatorId/places", async (req) => {
    const r = await req.container.handlers.getIndicatorPlaces.handle(ctx(req), param(req, "indicatorId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/indicators/:indicatorId/places", async (req) => {
    const r = await req.container.handlers.setIndicatorPlaces.handle(ctx(req), param(req, "indicatorId"), SetIndicatorPlacesSchema.parse(req.body) as never);
    if (!r.ok) throw r.error;
    return r.value;
  });
}
