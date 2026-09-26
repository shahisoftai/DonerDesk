import type { FastifyInstance } from "fastify";
import { UpdateTemplateMappingSchema, LockTemplateMappingSchema } from "@donordesk/contracts";

/**
 * Donor-template rendering (docxtpl) — mapping detect/review/approve/lock
 * routes. See memorybank/Features/20-report-gen.md §19 and Fixes.md for the
 * full design. `detect` and `approve` take the DOCX bytes as multipart
 * (same pattern as `POST /v1/templates/parse-file`) rather than fetching
 * from storage — there is no generic byte-fetch port in this codebase, and
 * the frontend holds the file for the whole review session anyway.
 */
export async function registerDonorTemplateMappingRoutes(app: FastifyInstance) {
  app.post("/v1/templates/:templateId/mappings/detect", async (req) => {
    const templateId = (req.params as { templateId: string }).templateId;
    const data = await req.file();
    if (!data) throw new Error("file required");
    const fileBuffer = await data.toBuffer();
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.detectTemplateRegions.handle(ctx, {
      templateId,
      fileBuffer,
      fileName: data.filename ?? "template.docx",
    });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/templates/:templateId/mappings", async (req) => {
    const templateId = (req.params as { templateId: string }).templateId;
    const r = await req.container.donorTemplateMappings.findByTemplate(templateId, req.tenant.tenantId);
    if (!r.ok) throw r.error;
    return { items: r.value.map(mappingToDto) };
  });

  app.get("/v1/templates/:templateId/mappings/:version", async (req) => {
    const { templateId, version } = req.params as { templateId: string; version: string };
    const r = await req.container.donorTemplateMappings.findByTemplateAndVersion(templateId, Number(version), req.tenant.tenantId);
    if (!r.ok) throw r.error;
    if (!r.value) return null;
    return mappingToDto(r.value);
  });

  app.put("/v1/mappings/:id/regions", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = UpdateTemplateMappingSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.updateTemplateMapping.handle(ctx, { mappingId: id, regionUpdates: body.regionUpdates });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/mappings/:id/approve", async (req) => {
    const id = (req.params as { id: string }).id;
    const data = await req.file();
    if (!data) throw new Error("original template file required to approve");
    const originalFileBuffer = await data.toBuffer();
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.approveTemplateMapping.handle(ctx, { mappingId: id, originalFileBuffer });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/reporting-periods/:id/lock-template-mapping", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = LockTemplateMappingSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.lockTemplateMapping.handle(ctx, { reportingPeriodId: id, mappingId: body.mappingId });
    if (!r.ok) throw r.error;
    return r.value;
  });
}

function mappingToDto(m: { id: string; templateId: string; version: number; regionsList: unknown[]; detectedRegions: unknown[]; approvedById: string | undefined; approvedAt: Date | undefined; templatedFileUrl: string | undefined }) {
  return {
    id: m.id,
    templateId: m.templateId,
    version: m.version,
    regions: m.regionsList,
    detectedRegions: m.detectedRegions,
    approvedById: m.approvedById ?? null,
    approvedAt: m.approvedAt ?? null,
    templatedFileUrl: m.templatedFileUrl ?? null,
  };
}
