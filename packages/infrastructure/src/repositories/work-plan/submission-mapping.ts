import type { IProjectSubmissionMappingRepository } from "@donordesk/application";
import { DomainError, ok } from "@donordesk/domain";
import type { Result, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

/** The column mapping a project saves for imports (phase 28.1-I). One per project. */
export class PrismaProjectSubmissionMappingRepository implements IProjectSubmissionMappingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async find(projectId: string, tenantId: TenantId): Promise<Result<Record<string, string> | null, DomainError>> {
    const row = await this.prisma.projectSubmissionMapping.findFirst({ where: { tenantId: tenantId.toString(), projectId } });
    return ok(row ? (JSON.parse(row.mappingJson) as Record<string, string>) : null);
  }

  async save(projectId: string, mapping: Record<string, string>, by: { userId: string; now: Date }, tenantId: TenantId): Promise<Result<void, DomainError>> {
    const tenant = tenantId.toString();
    await this.prisma.projectSubmissionMapping.upsert({
      where: { projectId },
      create: { id: `${tenant}:${projectId}:submission-mapping`, tenantId: tenant, projectId, mappingJson: JSON.stringify(mapping), updatedById: by.userId, updatedAt: by.now },
      update: { mappingJson: JSON.stringify(mapping), updatedById: by.userId, updatedAt: by.now },
    });
    return ok(undefined);
  }
}
