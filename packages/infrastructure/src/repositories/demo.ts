import { PrismaClient } from "@prisma/client";
import { DomainError, type Result, type TenantId } from "@donordesk/domain";
import type { IDemoProjectRepository } from "@donordesk/application";

/**
 * Deletes everything a DonorDesk Academy demo project (Feature 22) owns.
 * Scoped to `isDemo` projects only by the calling handler — this repository
 * trusts that check and deletes unconditionally by tenant + project id.
 *
 * Deletion order matters: children are removed before the rows they
 * reference. `DonorTemplateVersion`, `ReportRevision`, and `ReportArtifact`
 * cascade automatically via `onDelete: Cascade` in the schema and are not
 * listed explicitly. `AuditEvent` and `Comment` are never deleted — they are
 * plain string references, not enforced foreign keys, and the audit trail
 * must survive the entity it describes.
 */
export class PrismaDemoProjectRepository implements IDemoProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async deleteDemoProjectData(tenantId: TenantId, projectId: string): Promise<Result<void, DomainError>> {
    const tid = tenantId.toString();
    try {
      await this.prisma.$transaction([
        this.prisma.reportClaim.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.reportSection.deleteMany({
          where: { tenantId: tid, reportDraft: { projectId } },
        }),
        this.prisma.indicatorUpdate.deleteMany({
          where: { tenantId: tid, indicator: { projectId } },
        }),
        this.prisma.reportDraft.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.indicator.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.logframeItem.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.donorTemplate.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.reportingPeriod.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.activityUpdate.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.evidenceFile.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.checklistItem.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.exportPackage.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.reportPlan.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.reportGenerationRun.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.projectRiskTrend.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.submissionSnapshot.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.awardReportingOverride.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.projectMember.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.projectSetup.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.reportingProfile.deleteMany({ where: { tenantId: tid, projectId } }),
        this.prisma.project.deleteMany({ where: { tenantId: tid, id: projectId, isDemo: true } }),
      ]);
      return { ok: true, value: undefined };
    } catch (e) {
      return { ok: false, error: DomainError.conflict(`Failed to delete demo project: ${String(e)}`) };
    }
  }
}
