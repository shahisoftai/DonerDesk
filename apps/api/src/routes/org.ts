import type { FastifyInstance } from "fastify";
import { OrganizationProfileSchema, UpdateOrganizationReportingDefaultsSchema, UpdateAgentMemorySettingsSchema, SaveProgrammeSchema, SaveGrantSchema, PlaceProjectSchema } from "@donordesk/contracts";
import { isTruthyFlag } from "@donordesk/infrastructure";

// Resolved once per process, mirroring container.ts's own read of the same
// env var — the platform half of the Agent Memory two-flag gate (§4.1/§8).
// The web Settings tab is hidden entirely when this is false, regardless of
// the tenant's own Organization.agentMemoryEnabled toggle.
const agentMemoryPlatformEnabled = isTruthyFlag(process.env.AGENT_MEMORY_ENABLED);

export async function registerOrgRoutes(app: FastifyInstance) {
  app.get("/v1/organization", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const result = await req.container.organizations.findByTenant(req.tenant.tenantId);
    if (!result.ok) throw result.error;
    if (!result.value) {
      return {
        name: "", organizationType: "OTHER", country: "", sectors: [],
        contactName: "", contactEmail: "", defaultLanguage: "en",
        reportingDefaults: { tone: "FORMAL", formattingRules: [], autoPeriodCreation: false },
        agentMemoryEnabled: false,
        agentMemoryPlatformEnabled,
      };
    }
    const o = result.value;
    return {
      id: o.id,
      name: o.name,
      organizationType: o.organizationType,
      country: o.country,
      sectors: o.sectors,
      contactName: o.contactName,
      contactEmail: o.contactEmail,
      website: o.website,
      defaultLanguage: o.defaultLanguage,
      timeZone: o.timeZone,
      logoUrl: o.logoUrl,
      mainOfficeLocation: o.mainOfficeLocation,
      donorTypesServed: o.donorTypesServed,
      dataResidency: o.dataResidency,
      aiEnabled: o.aiEnabled,
      storageProvider: o.storageProvider,
      reportingDefaults: o.reportingDefaults,
      agentMemoryEnabled: o.agentMemoryEnabled,
      agentMemoryPlatformEnabled,
    };
  });

  // The whole organisation as one ZIP of newline-delimited JSON (and, with ?files=1, the evidence files). Administrators only.
  app.get("/v1/organization/export", async (req, reply) => {
    const includeFiles = (req.query as { files?: string }).files === "1";
    const r = await req.container.handlers.exportOrganization.handle({ tenant: req.tenant, requestId: req.id }, { includeFiles });
    if (!r.ok) throw r.error;
    reply.header("content-type", "application/zip");
    reply.header("content-disposition", `attachment; filename="${r.value.fileName}"`);
    reply.header("cache-control", "private, no-store");
    return reply.send(r.value.stream);
  });

  // Programmes > grants > projects: the funding hierarchy and what each level adds up to.
  app.get("/v1/funding", async (req) => {
    const r = await req.container.handlers.listFunding.handle({ tenant: req.tenant, requestId: req.id });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/programmes", async (req) => {
    const body = SaveProgrammeSchema.parse(req.body);
    const r = await req.container.handlers.saveProgramme.handle({ tenant: req.tenant, requestId: req.id }, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/programmes/:id", async (req) => {
    const body = SaveProgrammeSchema.parse(req.body);
    const r = await req.container.handlers.saveProgramme.handle({ tenant: req.tenant, requestId: req.id }, { ...body, id: (req.params as { id: string }).id });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/grants", async (req) => {
    const body = SaveGrantSchema.parse(req.body);
    const r = await req.container.handlers.saveGrant.handle({ tenant: req.tenant, requestId: req.id }, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/grants/:id", async (req) => {
    const body = SaveGrantSchema.parse(req.body);
    const r = await req.container.handlers.saveGrant.handle({ tenant: req.tenant, requestId: req.id }, { ...body, id: (req.params as { id: string }).id });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/projects/:projectId/funding", async (req) => {
    const body = PlaceProjectSchema.parse(req.body);
    const r = await req.container.handlers.placeProject.handle({ tenant: req.tenant, requestId: req.id }, (req.params as { projectId: string }).projectId, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/organization", async (req) => {
    const body = OrganizationProfileSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const result = await req.container.handlers.updateOrganization.handle(ctx, body);
    if (!result.ok) throw result.error;
    return { ok: true };
  });

  // Account-wide default reporting profile (seeds new projects).
  app.put("/v1/organization/reporting-defaults", async (req) => {
    const body = UpdateOrganizationReportingDefaultsSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const result = await req.container.handlers.updateOrganizationReportingDefaults.handle(ctx, body);
    if (!result.ok) throw result.error;
    return { ok: true };
  });

  // Agent Memory (Phase 21) tenant self-service toggle (§4.1).
  app.put("/v1/organization/agent-memory-settings", async (req) => {
    const body = UpdateAgentMemorySettingsSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const result = await req.container.handlers.updateAgentMemorySettings.handle(ctx, body);
    if (!result.ok) throw result.error;
    return { ok: true };
  });
}
