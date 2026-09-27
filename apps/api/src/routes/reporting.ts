import type { FastifyInstance } from "fastify";
import { CreateReportingPeriodSchema, GenerateDraftSchema, UpdateSectionSchema, CreateReportSectionSchema, UpdateSectionChartSchema, ReviewReportSchema, RewriteSectionSchema, RejectReportSchema, ResolveReportClaimSchema, BulkResolveReportClaimSchema, UpsertRequirementPackSchema, UpsertAwardOverrideSchema, ReassessRevisionSchema, RegenerateSectionSchema, ReorderReportSectionsSchema, UpdateReportingPeriodStorySchema, SmartReviewSummarySchema, PreviewPeriodValuesSchema, ConfirmPeriodValuesSchema, ProposeFieldReportExtractionSchema, ApplyFieldReportExtractionSchema } from "@donordesk/contracts";

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

  app.put("/v1/reporting-periods/:id/story", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = UpdateReportingPeriodStorySchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.updateReportingPeriodStory.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.get("/v1/reporting-periods/:id/story", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const period = await req.container.periods.findById(id, ctx.tenant.tenantId);
    if (!period.ok || !period.value) return { storyContext: {} };
    return { storyContext: period.value.storyContext };
  });

  app.post("/v1/reporting-periods/:id/generate-draft", async (req) => {
    const id = (req.params as { id: string }).id;
    GenerateDraftSchema.parse(req.body ?? {});
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.generateReportDraft.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/reporting-periods/period-values/preview", async (req) => {
    const body = PreviewPeriodValuesSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.importPeriodIndicatorValues.preview(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/reporting-periods/period-values/confirm", async (req) => {
    const body = ConfirmPeriodValuesSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.importPeriodIndicatorValues.confirm(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/reporting-periods/field-report/propose", async (req) => {
    const body = ProposeFieldReportExtractionSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.proposeFieldReportExtraction.handle(ctx, body.text);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/reporting-periods/field-report/apply", async (req) => {
    const body = ApplyFieldReportExtractionSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.applyFieldReportExtraction.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/reporting-periods/:id/smart-review", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getSmartReview.handle(ctx, id);
    if (!r.ok) throw r.error;
    return SmartReviewSummarySchema.parse(r.value);
  });

  app.get("/v1/reporting-periods/:id/draft", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getReportDraft.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/reporting-periods/:id/cancel-generation", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.cancelReportGeneration.handle(ctx, id);
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
    const handler = req.container.handlers.rewriteReportSection;
    const r = body.preview ? await handler.preview(ctx, id, body) : await handler.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/report-sections/:id/regenerate", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = RegenerateSectionSchema.parse(req.body ?? {});
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.regenerateReportSection.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return reply.code(202).send(r.value);
  });

  app.get("/v1/report-sections/:id/revisions", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listSectionRevisions.handle(ctx, id);
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

  app.post("/v1/report-drafts/:id/activate", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.activateReportDraft.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/report-claims/:id/resolve", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = ResolveReportClaimSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.resolveReportClaim.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/report-claims/:id/reopen", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.reopenReportClaim.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.get("/v1/report-claims/:id/suggestion", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getClaimSuggestion.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/report-claims/bulk-resolve", async (req) => {
    const body = BulkResolveReportClaimSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.bulkResolveReportClaims.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
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
