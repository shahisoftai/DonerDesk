import type { FastifyInstance } from "fastify";
import { EvidenceSearchSchema, AcceptEvidenceTagsSchema, ImportEvidenceTextSchema } from "@donordesk/contracts";
import { buildEvidenceTemplate, EVIDENCE_TEMPLATE_FILENAME } from "@donordesk/infrastructure";

export async function registerEvidenceRoutes(app: FastifyInstance) {
  app.get("/v1/evidence/template", async (_req, reply) => {
    const buffer = await buildEvidenceTemplate();
    reply.header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("content-disposition", `attachment; filename="${EVIDENCE_TEMPLATE_FILENAME}"`);
    return buffer;
  });

  app.post("/v1/evidence/import", async (req) => {
    const body = ImportEvidenceTextSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.importEvidence.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/evidence/parse-file", async (req) => {
    const data = await req.file();
    if (!data) throw new Error("file required");
    const buffer = await data.toBuffer();
    const result = await req.container.parser.parse({
      buffer,
      fileName: data.filename ?? "upload",
      fileType: data.mimetype ?? "application/octet-stream",
    });
    return { text: result.text, metadata: result.metadata };
  });
  app.post("/v1/evidence/upload", async (req) => {
    const data = await req.file();
    if (!data) throw new Error("file required");
    const buffer = await data.toBuffer();
    const fields = data.fields as Record<string, { value?: string } | undefined>;
    const payload = {
      projectId: fields.projectId?.value,
      title: fields.title?.value,
      evidenceType: fields.evidenceType?.value,
      reportingPeriodId: fields.reportingPeriodId?.value,
      activityId: fields.activityId?.value,
      indicatorId: fields.indicatorId?.value,
      location: fields.location?.value,
      activityDate: fields.activityDate?.value,
      confidentialityLevel: fields.confidentialityLevel?.value,
      notes: fields.notes?.value,
    };
    if (!payload.projectId || !payload.title || !payload.evidenceType) throw new Error("missing required fields");
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.uploadEvidence.handle(ctx, {
      projectId: payload.projectId,
      title: payload.title,
      fileName: data.filename ?? "upload.bin",
      fileUrl: "",
      fileType: data.mimetype ?? "application/octet-stream",
      fileSize: buffer.length,
      evidenceType: payload.evidenceType as never,
      reportingPeriodId: payload.reportingPeriodId || undefined,
      activityId: payload.activityId || undefined,
      indicatorId: payload.indicatorId || undefined,
      location: payload.location || undefined,
      activityDate: payload.activityDate || undefined,
      confidentialityLevel: (payload.confidentialityLevel as never) ?? "INTERNAL",
      notes: payload.notes || undefined,
      buffer,
      originalFileName: data.filename ?? "upload.bin",
    });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/evidence/search", async (req) => {
    const body = EvidenceSearchSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.searchEvidence.handle(ctx, {
      ...body,
      dateFrom: body.dateFrom ? new Date(body.dateFrom) : undefined,
      dateTo: body.dateTo ? new Date(body.dateTo) : undefined,
    });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/evidence/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getEvidence.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/evidence/:id/accept-tags", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = AcceptEvidenceTagsSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.acceptEvidenceTags.handle(ctx, id, body.indices);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/evidence/:id/verify", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.verifyEvidence.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
