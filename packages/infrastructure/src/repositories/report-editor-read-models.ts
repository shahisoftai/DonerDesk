import type { PrismaClient } from "@prisma/client";
import type { EvidenceLabel, IEvidenceDirectory, IReportInputsChangeReader, ReportInputsChange } from "@donordesk/application";
import type { DomainError, Result, TenantId } from "@donordesk/domain";

function parseIds(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Evidence titles and confidentiality for editor labels (Report Editor B2). */
export class PrismaEvidenceDirectory implements IEvidenceDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  async describe(ids: readonly string[], tenantId: TenantId): Promise<Result<EvidenceLabel[], DomainError>> {
    if (ids.length === 0) return { ok: true, value: [] };
    const rows = await this.prisma.evidenceFile.findMany({
      where: { tenantId: tenantId.toString(), id: { in: [...ids] } },
      select: { id: true, title: true, fileName: true, confidentialityLevel: true },
    });
    return {
      ok: true,
      value: rows.map((r) => ({ id: r.id, title: r.title.trim() || r.fileName, confidentialityLevel: r.confidentialityLevel })),
    };
  }
}

/**
 * Report inputs changed after a draft was written (Report Editor B6): the
 * period's indicator values, and evidence of the period or attached to its
 * indicator values and activities. Reads stored timestamps directly.
 */
export class PrismaReportInputsChangeReader implements IReportInputsChangeReader {
  constructor(private readonly prisma: PrismaClient) {}

  async changedSince(input: { reportingPeriodId: string; since: Date; tenantId: TenantId }): Promise<Result<ReportInputsChange, DomainError>> {
    const tenantId = input.tenantId.toString();
    const [updates, activities] = await Promise.all([
      this.prisma.indicatorUpdate.findMany({
        where: { tenantId, reportingPeriodId: input.reportingPeriodId },
        select: { id: true, indicatorId: true, attachedEvidenceIds: true, updatedAt: true },
      }),
      this.prisma.activityUpdate.findMany({
        where: { tenantId, reportingPeriodId: input.reportingPeriodId },
        select: { attachedEvidenceIds: true },
      }),
    ]);
    const changedUpdates = updates.filter((u) => u.updatedAt > input.since);
    const attached = new Set([...updates, ...activities].flatMap((row) => parseIds(row.attachedEvidenceIds)));
    const evidence = await this.prisma.evidenceFile.findMany({
      where: {
        tenantId,
        updatedAt: { gt: input.since },
        OR: [{ reportingPeriodId: input.reportingPeriodId }, { id: { in: [...attached] } }],
      },
      select: { id: true },
    });
    return {
      ok: true,
      value: {
        indicatorIds: [...new Set(changedUpdates.map((u) => u.indicatorId))],
        indicatorUpdateIds: changedUpdates.map((u) => u.id),
        evidenceIds: evidence.map((e) => e.id),
      },
    };
  }
}
