import type { FastifyInstance } from "fastify";
import { CreateReportingPeriodSchema, GenerateDraftSchema, UpdateSectionSchema, CreateReportSectionSchema, UpdateSectionChartSchema, ReviewReportSchema, RewriteSectionSchema, RejectReportSchema, ResolveReportClaimSchema, UpsertRequirementPackSchema, UpsertAwardOverrideSchema, ReassessRevisionSchema, ReorderReportSectionsSchema } from "@donordesk/contracts";

export async function registerReportingRoutes(app: FastifyInstance) {
  app.get("/v1/projects/:projectId/reporting-periods", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listReportingPeriods.handle(ctx, projectId);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.get("/v1/reporting-periods/:id/indicators", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listPeriodIndicators.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/reporting-periods", async (req) => {
    const body = CreateReportingPeriodSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.createReportingPeriod.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/reporting-periods/:id/generate-draft", async (req) => {
    const id = (req.params as { id: string }).id;
    GenerateDraftSchema.parse(req.body ?? {});
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.generateReportDraft.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/reporting-periods/:id/draft", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getReportDraft.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/report-sections/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = UpdateSectionSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.updateReportSection.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/report-sections", async (req) => {
    const body = CreateReportSectionSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.createReportSection.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.delete("/v1/report-sections/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.deleteReportSection.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.put("/v1/report-drafts/:id/sections-order", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = ReorderReportSectionsSchema.parse(req.body ?? {});
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.reorderReportSections.handle(ctx, id, body.sectionIds);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.patch("/v1/report-sections/:id/chart", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = UpdateSectionChartSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.updateReportSectionChart.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/report-sections/:id/rewrite", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = RewriteSectionSchema.parse(req.body ?? {});
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.rewriteReportSection.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/report-sections/:id/approve", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.approveReportSection.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/report-drafts/:id/submit-for-review", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.submitReportForReview.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/report-drafts/:id/approve", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = ReviewReportSchema.parse(req.body ?? {});
    if (body.decision !== "APPROVE") {
      return { ok: false, message: "Use /reject for revisions" };
    }
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.approveReport.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/report-drafts/:id/reject", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = RejectReportSchema.parse(req.body ?? {});
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.rejectReport.handle(ctx, id, body.notes);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/report-claims/:id/resolve", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = ResolveReportClaimSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.resolveReportClaim.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.get("/v1/report-drafts/:id/assurance", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getReportAssurance.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/report-sections/:id/reassess", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = ReassessRevisionSchema.parse(req.body ?? {});
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.reassessReportRevision.handle(ctx, id, body.revisionId);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/reporting-periods/:id/resolve-requirements", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.resolveEffectiveRequirements.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/reporting-requirement-packs", async (req) => {
    const body = UpsertRequirementPackSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.upsertRequirementPack.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/reporting-requirement-packs/:id/activate", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.activateRequirementPack.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/award-reporting-overrides", async (req) => {
    const body = UpsertAwardOverrideSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.upsertAwardOverride.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/report-drafts/:id/submission-snapshot", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.createSubmissionSnapshot.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });
}
