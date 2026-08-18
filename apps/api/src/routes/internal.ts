import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { InternalEvidenceResponseSchema, PersistTagsBodySchema, CreateExportSchema, InternalEvidenceUploadSchema } from "@donordesk/contracts";
import { createContainer } from "@donordesk/infrastructure";
import { internalAuthMiddleware } from "../middleware/internal.js";

const ReportingPeriodBodySchema = z.object({ reportingPeriodId: z.string().min(1) });
const RemindersBodySchema = z.object({ reportingPeriodId: z.string().min(1), recipientId: z.string().min(1).optional() });

/**
 * Internal service-to-service routes called by Kestra flows and the workers.
 * Registered OUTSIDE the public tenant-auth plugin; they authenticate via the
 * internal token + HMAC middleware instead of a user JWT. Tenant isolation is
 * still enforced: the per-request container is bound to the signed tenant.
 */
export async function registerInternalRoutes(app: FastifyInstance) {
  await app.register(async (instance) => {
    instance.addHook("preHandler", internalAuthMiddleware);
    instance.addHook("preHandler", async (req) => {
      req.container = createContainer({ tenantId: req.tenant.tenantId.toString() });
    });
    instance.addHook("onResponse", async (req) => {
      await req.container?.prisma.$disconnect();
    });

    instance.get("/internal/evidence/:id", async (req) => {
      const id = (req.params as { id: string }).id;
      const ctx = { tenant: req.tenant, requestId: req.id };
      const r = await req.container.handlers.getEvidence.handle(ctx, id);
      if (!r.ok) throw r.error;
      const dto = r.value as {
        id: string;
        projectId: string;
        reportingPeriodId?: string;
        activityId?: string;
        indicatorId?: string;
        fileName: string;
        title: string;
        fileUrl: string;
        fileType: string;
        fileSize: number;
        evidenceType: string;
        storageProvider?: string;
        driveFileId?: string;
        driveWebLink?: string;
        location?: string;
        activityDate?: string;
        uploadedById: string;
        verificationStatus: string;
        confidentialityLevel: string;
        notes?: string;
        aiSummary?: string;
        extractedText?: string;
        aiSuggestedTags: unknown[];
      };
      const storageKey = dto.fileUrl.startsWith("/v1/files/")
        ? decodeURIComponent(dto.fileUrl.slice("/v1/files/".length))
        : undefined;
      return InternalEvidenceResponseSchema.parse({
        id: dto.id,
        projectId: dto.projectId,
        reportingPeriodId: dto.reportingPeriodId,
        activityId: dto.activityId,
        indicatorId: dto.indicatorId,
        fileName: dto.fileName,
        title: dto.title,
        fileUrl: dto.fileUrl,
        storageKey,
        storageProvider: dto.storageProvider ?? "LOCAL",
        driveFileId: dto.driveFileId,
        driveWebLink: dto.driveWebLink,
        fileType: dto.fileType,
        fileSize: dto.fileSize,
        evidenceType: dto.evidenceType,
        location: dto.location,
        activityDate: dto.activityDate,
        uploadedById: dto.uploadedById,
        verificationStatus: dto.verificationStatus,
        confidentialityLevel: dto.confidentialityLevel,
        notes: dto.notes,
        aiSummary: dto.aiSummary,
        extractedText: dto.extractedText,
        aiSuggestedTags: dto.aiSuggestedTags,
      });
    });

    // Signed internal file-content endpoint. Kestra flows (e.g. the Tika
    // evidence_parse flow) fetch the actual uploaded bytes here to run real
    // document text/OCR extraction. It is tenant-isolated: the per-request
    // container is bound to the signed tenant, and `storageKey` is derived from
    // the evidence record, so a caller can only read files it could already
    // resolve via GET /internal/evidence/:id. Byte-stored evidence is streamed;
    // Drive-backed evidence has no local bytes and returns its resolved link.
    instance.get("/internal/evidence/:id/content", async (req, reply) => {
      const id = (req.params as { id: string }).id;
      const ctx = { tenant: req.tenant, requestId: req.id };
      const r = await req.container.handlers.getEvidence.handle(ctx, id);
      if (!r.ok) throw r.error;
      const dto = r.value as { fileUrl: string; fileType: string; fileName: string; storageProvider?: string; driveFileId?: string; driveWebLink?: string };
      const storageKey = dto.fileUrl.startsWith("/v1/files/")
        ? decodeURIComponent(dto.fileUrl.slice("/v1/files/".length))
        : undefined;
      if (!storageKey) {
        // Google Drive evidence: return the resolved link as JSON so the flow
        // can fetch via the Drive API by file ID instead of streaming bytes.
        return reply.header("x-file-location", encodeURIComponent(dto.fileUrl)).send({ driveFileId: dto.driveFileId, fileUrl: dto.fileUrl });
      }
      const buffer = await req.container.storage.read(storageKey);
      return reply
        .type(dto.fileType || "application/octet-stream")
        .header("x-file-name", encodeURIComponent(dto.fileName))
        .send(buffer);
    });

    instance.post("/internal/evidence/:id/tags", async (req) => {
      const id = (req.params as { id: string }).id;
      const body = PersistTagsBodySchema.parse(req.body);
      const ctx = { tenant: req.tenant, requestId: req.id };
      const r = await req.container.handlers.persistEvidenceTags.handle(ctx, id, {
        summary: body.summary,
        tags: body.tags,
        sensitivityWarning: body.sensitivityWarning,
        model: body.model,
        extractedText: body.extractedText,
        idempotencyKey: body.idempotencyKey,
      });
      if (!r.ok) throw r.error;
      return { ok: true };
    });

    // Signed inbound evidence upload used by Kestra connector flows (Google
    // Drive, SFTP). The body is Base64 JSON so it can be HMAC-signed like the
    // other /internal/* routes; the tenant container is bound to the signed
    // tenant, so RLS still scopes the write. Uploading publishes an
    // EvidenceUploaded event, which the outbox maps to the evidence.suggest_tags
    // job (Kestra) for downstream tagging/parsing.
    instance.post("/internal/evidence/upload", async (req) => {
      const body = InternalEvidenceUploadSchema.parse(req.body);
      const buffer = body.fileBase64 ? Buffer.from(body.fileBase64, "base64") : undefined;
      const ctx = { tenant: req.tenant, requestId: req.id };
      const r = await req.container.handlers.uploadEvidence.handle(ctx, {
        projectId: body.projectId,
        title: body.title,
        fileName: body.fileName,
        fileUrl: "",
        fileType: body.fileType,
        fileSize: buffer?.length ?? 0,
        evidenceType: body.evidenceType as never,
        reportingPeriodId: body.reportingPeriodId || undefined,
        activityId: body.activityId || undefined,
        indicatorId: body.indicatorId || undefined,
        location: body.location || undefined,
        activityDate: body.activityDate || undefined,
        confidentialityLevel: body.confidentialityLevel as never,
        notes: body.notes || undefined,
        buffer,
        originalFileName: body.fileName,
        driveFileId: body.driveFileId,
        driveWebLink: body.driveWebLink,
      });
      if (!r.ok) throw r.error;
      return r.value;
    });

    instance.post("/internal/readiness/recompute", async (req) => {
      const { reportingPeriodId } = ReportingPeriodBodySchema.parse(req.body);
      const ctx = { tenant: req.tenant, requestId: req.id };
      const r = await req.container.handlers.recomputeReadiness.handle(ctx, reportingPeriodId);
      if (!r.ok) throw r.error;
      return r.value;
    });

    instance.post("/internal/checklist/generate", async (req) => {
      const { reportingPeriodId } = ReportingPeriodBodySchema.parse(req.body);
      const ctx = { tenant: req.tenant, requestId: req.id };
      const r = await req.container.handlers.generateChecklist.handle(ctx, reportingPeriodId);
      if (!r.ok) throw r.error;
      return r.value;
    });

    instance.post("/internal/export/run", async (req) => {
      const body = CreateExportSchema.parse(req.body);
      const ctx = { tenant: req.tenant, requestId: req.id };
      const r = await req.container.handlers.runExport.handle(ctx, body);
      if (!r.ok) throw r.error;
      return r.value;
    });

    instance.post("/internal/reminders/deadline", async (req) => {
      const body = RemindersBodySchema.parse(req.body);
      const ctx = { tenant: req.tenant, requestId: req.id };
      const r = await req.container.handlers.generateDeadlineReminders.handle(ctx, body);
      if (!r.ok) throw r.error;
      return r.value;
    });

    // Billing reconciliation entry points for scheduled Kestra flows. These are
    // tenant-scoped (the per-request container is bound to the signed tenant)
    // and idempotent: replay converges rather than double-applies.
    instance.post("/internal/billing/expire-trials", async (req) => {
      const r = await req.container.handlers.expireLocalTrials.handle();
      if (!r.ok) throw r.error;
      return r.value;
    });

    instance.post("/internal/billing/reconcile-subscriptions", async (req) => {
      const r = await req.container.handlers.reconcileBillingSubscriptions.handle();
      if (!r.ok) throw r.error;
      return r.value;
    });

    instance.post("/internal/billing/reconcile-storage", async (req) => {
      const r = await req.container.handlers.reconcileManagedStorageUsage.handle();
      if (!r.ok) throw r.error;
      return r.value;
    });

    instance.post("/internal/billing/release-stale-reservations", async (req) => {
      const r = await req.container.handlers.releaseStaleUsageReservations.handle();
      if (!r.ok) throw r.error;
      return r.value;
    });

    instance.post("/internal/billing/retry-inbox", async (req) => {
      const r = await req.container.handlers.retryBillingInbox.handle();
      if (!r.ok) throw r.error;
      return r.value;
    });
  });
}
