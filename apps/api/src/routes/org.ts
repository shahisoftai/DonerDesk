import type { FastifyInstance } from "fastify";
import { OrganizationProfileSchema, UpdateOrganizationReportingDefaultsSchema } from "@donordesk/contracts";

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
      logoUrl: o.logoUrl,
      mainOfficeLocation: o.mainOfficeLocation,
      donorTypesServed: o.donorTypesServed,
      dataResidency: o.dataResidency,
      aiEnabled: o.aiEnabled,
      storageProvider: o.storageProvider,
      reportingDefaults: o.reportingDefaults,
    };
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
}
