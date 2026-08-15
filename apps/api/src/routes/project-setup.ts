import type { FastifyInstance } from "fastify";
import { UpsertReportingProfileSchema, AcknowledgeProjectSetupSchema } from "@donordesk/contracts";

/**
 * Feature 18 project setup + reporting profile routes. Registered inside the
 * tenant-auth plugin so every route is authenticated and tenant-scoped.
 */
export async function registerProjectSetupRoutes(app: FastifyInstance) {
  // Derived setup checklist + blockers.
  app.get("/v1/projects/:projectId/setup", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getProjectSetup.handle(ctx, projectId);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Optional user acknowledgement (audit-only; not a readiness gate).
  app.post("/v1/projects/:projectId/setup/acknowledge", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    AcknowledgeProjectSetupSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.acknowledgeProjectSetup.handle(ctx, projectId);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Idempotent workspace provisioning retry.
  app.post("/v1/projects/:projectId/workspace/retry", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.retryProjectWorkspace.handle(ctx, projectId);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Verify/repair workspace structure (idempotent).
  app.post("/v1/projects/:projectId/workspace/repair", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.repairProjectWorkspace.handle(ctx, projectId);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Reporting profile read + versioned upsert.
  app.get("/v1/projects/:projectId/reporting-profile", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.getReportingProfile.handle(ctx, projectId);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/projects/:projectId/reporting-profile", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const body = UpsertReportingProfileSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.upsertReportingProfile.handle(ctx, projectId, body);
    if (!r.ok) throw r.error;
    return r.value;
  });
}
