import type { PrismaClient } from "@prisma/client";
import { ok, type TenantId } from "@donordesk/domain";
import type { IDonorIndicatorMappingRepository } from "@donordesk/application";

export class PrismaDonorIndicatorMappingRepository implements IDonorIndicatorMappingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByTemplate(templateId: string, tenantId: TenantId) {
    const rows = await this.prisma.donorIndicatorMapping.findMany({ where: { tenantId: tenantId.toString(), templateId }, select: { requirementId: true, indicatorId: true } });
    return ok(rows.map((r) => ({ requirementId: r.requirementId, indicatorId: r.indicatorId })));
  }

  async save(input: { id: string; tenantId: TenantId; templateId: string; requirementId: string; indicatorId: string | null; decidedById: string }) {
    const tenantId = input.tenantId.toString();
    await this.prisma.donorIndicatorMapping.upsert({
      where: { templateId_requirementId: { templateId: input.templateId, requirementId: input.requirementId } },
      create: { id: input.id, tenantId, templateId: input.templateId, requirementId: input.requirementId, indicatorId: input.indicatorId, decidedById: input.decidedById },
      // null (not undefined) so choosing "will not report it" really clears the indicator
      update: { indicatorId: input.indicatorId, decidedById: input.decidedById, decidedAt: new Date() },
    });
    return ok(undefined);
  }

  async clear(templateId: string, requirementId: string, tenantId: TenantId) {
    await this.prisma.donorIndicatorMapping.deleteMany({ where: { tenantId: tenantId.toString(), templateId, requirementId } });
    return ok(undefined);
  }
}
