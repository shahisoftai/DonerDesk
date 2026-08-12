import type { FastifyReply, FastifyRequest } from "fastify";
import { DATA_RESIDENCY_OPTIONS, DomainError, type DataResidency } from "@donordesk/domain";

export function configuredDataRegion(): DataResidency {
  const value = process.env.DATA_RESIDENCY_REGION ?? "DEFAULT";
  if (!DATA_RESIDENCY_OPTIONS.includes(value as DataResidency)) {
    throw new Error(`Invalid DATA_RESIDENCY_REGION: ${value}`);
  }
  return value as DataResidency;
}

export function requireResidencyMatch(organizationRegion: DataResidency, storageRegion = configuredDataRegion()): void {
  if (organizationRegion !== "DEFAULT" && storageRegion !== organizationRegion) {
    throw DomainError.forbidden("Write denied by organization data-residency policy", {
      organizationRegion,
      storageRegion,
    });
  }
}

export async function dataResidencyMiddleware(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const organization = await req.container.organizations.findByTenant(req.tenant.tenantId);
  if (!organization.ok) throw organization.error;
  if (!organization.value) throw DomainError.notFound("Organization", req.tenant.tenantId.toString());
  requireResidencyMatch(organization.value.dataResidency);
}
