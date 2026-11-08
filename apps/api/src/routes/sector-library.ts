import type { FastifyInstance } from "fastify";
import {
  AdoptLibraryIndicatorsSchema, AdoptLibraryLogframeSchema, ApplyLibraryUpdateSchema, BrowseLibraryQuerySchema, ImportLibraryReviewSheetSchema,
  RecordLibraryReviewSchema, SaveLibraryEntrySchema, SetLibraryEntryHiddenSchema,
} from "@donordesk/contracts";

/** The sector library (Phase 46). Thin: validate, call one handler, throw its error. The rules live in the domain and the handlers. */
export async function registerSectorLibraryRoutes(app: FastifyInstance) {
  const ctx = (req: { tenant: unknown; id: string }) => ({ tenant: req.tenant as never, requestId: req.id });
  const id = (req: { params: unknown }) => (req.params as { id: string }).id;

  app.get("/v1/sector-library", async (req) => {
    const q = BrowseLibraryQuerySchema.parse(req.query);
    const r = await req.container.handlers.browseSectorLibrary.handle(ctx(req), q as never);
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.get("/v1/sector-library/sectors/:id/pack", async (req) => {
    const r = await req.container.handlers.getSectorPack.handle(ctx(req), id(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/sector-library/adopt", async (req) => {
    const r = await req.container.handlers.adoptLibraryIndicators.handle(ctx(req), AdoptLibraryIndicatorsSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/sector-library/adopt-logframe", async (req) => {
    const r = await req.container.handlers.adoptLibraryLogframe.handle(ctx(req), AdoptLibraryLogframeSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.get("/v1/projects/:id/library-updates", async (req) => {
    const r = await req.container.handlers.checkLibraryUpdates.handle(ctx(req), id(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/indicators/:id/library-update", async (req) => {
    const body = ApplyLibraryUpdateSchema.parse(req.body);
    const r = await req.container.handlers.applyLibraryUpdate.handle(ctx(req), { indicatorId: id(req), fields: body.fields });
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/sector-library/entries", async (req) => {
    const r = await req.container.handlers.saveLibraryEntry.handle(ctx(req), SaveLibraryEntrySchema.parse(req.body) as never);
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.put("/v1/sector-library/entries/:id/hidden", async (req) => {
    const r = await req.container.handlers.setLibraryEntryHidden.handle(ctx(req), { entryId: id(req), hidden: SetLibraryEntryHiddenSchema.parse(req.body).hidden });
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/sector-library/review", async (req) => {
    const r = await req.container.handlers.recordLibraryReview.handle(ctx(req), RecordLibraryReviewSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.get("/v1/sector-library/review/sheet", async (req) => {
    const q = BrowseLibraryQuerySchema.pick({ sectors: true }).parse(req.query);
    const r = await req.container.handlers.exportLibraryReviewSheet.handle(ctx(req), { sectors: q.sectors as never });
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/sector-library/review/sheet", async (req) => {
    const r = await req.container.handlers.importLibraryReviewSheet.handle(ctx(req), ImportLibraryReviewSheetSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.get("/v1/sector-library/review/progress", async (req) => {
    const r = await req.container.handlers.getLibraryReviewProgress.handle(ctx(req));
    if (!r.ok) throw r.error;
    return r.value;
  });
}
