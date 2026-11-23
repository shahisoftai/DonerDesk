import type { FastifyInstance } from "fastify";
import { ApplyKitSchema, AssignFacilitiesSchema, CorrectiveActionSchema, MoveAssignmentSchema, SaveDraftSchema } from "@donordesk/contracts";
import { z } from "zod";

/**
 * Assessments and long surveys (Phase 62): drafts, facility assignments, scores, comparison, files, kits and reading a tool from a file.
 * Thin: validate, call one handler, throw its error. Permissions are in the handlers and in the authorization table.
 */
export async function registerAssessmentRoutes(app: FastifyInstance) {
  const ctx = (req: { tenant: unknown; id: string }) => ({ tenant: req.tenant as never, requestId: req.id });
  const param = (req: { params: unknown }, name: string) => (req.params as Record<string, string>)[name]!;
  const place = (req: { query: unknown }) => z.object({ placeId: z.string().min(1).max(64).optional() }).parse(req.query).placeId;

  // A long form in progress: the person's own draft for a facility.
  app.get("/v1/collection-forms/:formId/draft", async (req) => {
    const r = await req.container.handlers.getCollectionDraft.handle(ctx(req), param(req, "formId"), place(req));
    if (!r.ok) throw r.error;
    return { draft: r.value };
  });
  app.put("/v1/collection-forms/:formId/draft", async (req) => {
    const r = await req.container.handlers.saveCollectionDraft.handle(ctx(req), param(req, "formId"), SaveDraftSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.delete("/v1/collection-forms/:formId/draft", async (req) => {
    const r = await req.container.handlers.discardCollectionDraft.handle(ctx(req), param(req, "formId"), place(req));
    if (!r.ok) throw r.error;
    return { ok: true };
  });
  app.get("/v1/me/collection-drafts", async (req) => {
    const r = await req.container.handlers.listMyCollectionDrafts.handle(ctx(req));
    if (!r.ok) throw r.error;
    return { drafts: r.value };
  });

  // Facilities given to assessors.
  app.get("/v1/me/facility-assignments", async (req) => {
    const r = await req.container.handlers.listMyAssignments.handle(ctx(req));
    if (!r.ok) throw r.error;
    return { assignments: r.value };
  });
  app.get("/v1/collection-forms/:formId/assignments", async (req) => {
    const { level } = z.object({ level: z.coerce.number().int().min(0).max(4).optional() }).parse(req.query);
    const r = await req.container.handlers.listFacilityAssignments.handle(ctx(req), param(req, "formId"), level);
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/collection-forms/:formId/assignments", async (req) => {
    const r = await req.container.handlers.assignFacilities.handle(ctx(req), param(req, "formId"), AssignFacilitiesSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.post("/v1/collection-assignments/:assignmentId/move", async (req) => {
    const r = await req.container.handlers.moveAssignment.handle(ctx(req), param(req, "assignmentId"), MoveAssignmentSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // What the last accepted visit already says about the facts a form carries forward.
  app.get("/v1/collection-forms/:formId/prefill", async (req) => {
    const placeId = z.object({ placeId: z.string().min(1).max(64) }).parse(req.query).placeId;
    const r = await req.container.handlers.getAssessmentPrefill.handle(ctx(req), param(req, "formId"), placeId);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // A record's score, its comparison with an earlier visit, the file of it, and a follow-up action from a low item.
  app.get("/v1/collection-records/:recordId/score", async (req) => {
    const r = await req.container.handlers.getRecordScore.handle(ctx(req), param(req, "recordId"));
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.get("/v1/collection-records/:recordId/compare", async (req) => {
    const { against } = z.object({ against: z.string().min(1).max(64).optional() }).parse(req.query);
    const r = await req.container.handlers.compareVisits.handle(ctx(req), param(req, "recordId"), against);
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.get("/v1/collection-records/:recordId/export", async (req, reply) => {
    const q = z.object({ format: z.enum(["PDF", "DOCX", "XLSX"]).default("PDF"), language: z.string().min(2).max(8).optional() }).parse(req.query);
    const r = await req.container.handlers.exportAssessment.handle(ctx(req), param(req, "recordId"), q.format, q.language);
    if (!r.ok) throw r.error;
    reply.header("content-type", r.value.contentType);
    reply.header("content-disposition", `attachment; filename="${r.value.fileName.replace(/"/g, "")}"`);
    reply.header("x-content-type-options", "nosniff");
    reply.header("cache-control", "private, no-store");
    return r.value.bytes;
  });
  app.post("/v1/collection-records/:recordId/actions", async (req, reply) => {
    const r = await req.container.handlers.createCorrectiveAction.handle(ctx(req), param(req, "recordId"), CorrectiveActionSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });

  // Ready-made forms, and reading a Word or Excel tool into a proposed form.
  app.get("/v1/form-kits", async (req) => ({ kits: req.container.handlers.listFormKits.handle() }));
  app.post("/v1/form-kits/apply", async (req, reply) => {
    const r = await req.container.handlers.applyFormKit.handle(ctx(req), ApplyKitSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });
  app.post("/v1/collection-forms/propose", async (req) => {
    const data = await req.file({ limits: { fileSize: 10 * 1024 * 1024 + 1 } });
    if (!data) throw new Error("file required");
    const r = await req.container.handlers.proposeFormFromFile.handle(ctx(req), { name: data.filename ?? "tool", bytes: await data.toBuffer(), type: data.mimetype });
    if (!r.ok) throw r.error;
    return r.value;
  });
}
