import type { FastifyInstance } from "fastify";
import { CreateExportSchema } from "@donordesk/contracts";
import { exportFileName } from "@donordesk/application";
import type { ReportingPeriod } from "@donordesk/domain";

export async function registerExportRoutes(app: FastifyInstance) {
  app.post("/v1/exports", async (req) => {
    const body = CreateExportSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.createExport.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/reporting-periods/:id/export-preflight", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getExportPreflight.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:id/exports", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.exports.findByProject(id, req.tenant.tenantId);
    if (!r.ok) throw r.error;
    const project = await req.container.projects.findById(id, req.tenant.tenantId);
    const periodIds = [...new Set(r.value.map((e) => e.reportingPeriodId))];
    const periods = new Map<string, ReportingPeriod>();
    for (const pid of periodIds) {
      const p = await req.container.periods.findById(pid, req.tenant.tenantId);
      if (p.ok && p.value) periods.set(pid, p.value);
    }
    const nameOf = (e: (typeof r.value)[number]): string | undefined => {
      const period = periods.get(e.reportingPeriodId);
      if (!period || !project.ok || !project.value) return undefined;
      return exportFileName({ projectTitle: project.value.title, reportType: period.reportType, periodStart: period.duration.start, periodEnd: period.duration.end, version: e.version, exportType: e.exportType, intent: e.exportIntent });
    };
    return {
      items: r.value.map((e) => ({
        id: e.id,
        exportType: e.exportType,
        fileUrl: e.fileUrl,
        fileName: nameOf(e),
        version: e.version,
        exportedById: e.exportedById,
        includedFiles: e.includedFiles,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  });
}
