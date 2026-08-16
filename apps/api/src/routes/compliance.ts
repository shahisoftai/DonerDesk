import type { FastifyInstance } from "fastify";
import { ResolveChecklistItemSchema, BulkResolveChecklistSchema } from "@donordesk/contracts";

export async function registerComplianceRoutes(app: FastifyInstance) {
  app.get("/v1/reporting-periods/:id/checklist", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listChecklist.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/reporting-periods/:id/detect-missing", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.detectMissingEvidence.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/checklist/:id/resolve", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = ResolveChecklistItemSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.resolveChecklistItem.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/reporting-periods/:id/checklist/bulk-resolve", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = BulkResolveChecklistSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.bulkResolveChecklist.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/reporting-periods/:id/readiness", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.calculateReadiness.handle(ctx, id);
    if (!r.ok) throw r.error;
    return r.value;
  });
}
