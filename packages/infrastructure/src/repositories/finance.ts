import { PrismaClient } from "@prisma/client";
import { PeriodFinancialSummary, DomainError, type FinanceLine, type FinanceSource, type FinanceVerification, type Result, type TenantId } from "@donordesk/domain";
import type { IPeriodFinancialRepository } from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

function err<T = never>(e: unknown): Result<T, DomainError> {
  return { ok: false, error: new DomainError("CONFLICT", e instanceof Error ? e.message : String(e)) };
}

function parseLines(json: string): FinanceLine[] {
  try {
    const raw = JSON.parse(json) as unknown;
    return Array.isArray(raw) ? (raw as FinanceLine[]) : [];
  } catch {
    return [];
  }
}

export class PrismaPeriodFinancialRepository implements IPeriodFinancialRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<PeriodFinancialSummary | null, DomainError>> {
    try {
      const row = await this.prisma.periodFinancialSummary.findFirst({ where: { reportingPeriodId, tenantId: tenantId.toString() } });
      if (!row) return ok(null);
      return ok(
        PeriodFinancialSummary.rehydrate({
          id: row.id,
          tenantId: row.tenantId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          props: {
            projectId: row.projectId,
            reportingPeriodId: row.reportingPeriodId,
            currency: row.currency,
            lines: parseLines(row.linesJson),
            budget: row.budget,
            expenditure: row.expenditure,
            ...(row.committed ? { committed: row.committed } : {}),
            source: row.source as FinanceSource,
            ...(row.sourceNote ? { sourceNote: row.sourceNote } : {}),
            verificationStatus: row.verificationStatus as FinanceVerification,
            ...(row.verifiedById ? { verifiedById: row.verifiedById } : {}),
            ...(row.verifiedAt ? { verifiedAt: row.verifiedAt } : {}),
            createdById: row.createdById,
            updatedById: row.updatedById,
          },
        }),
      );
    } catch (e) {
      return err(e);
    }
  }

  async save(s: PeriodFinancialSummary): Promise<Result<PeriodFinancialSummary, DomainError>> {
    const figures = s.figures;
    const data = {
      currency: s.currency,
      budget: figures.budget,
      expenditure: figures.expenditure,
      committed: figures.committed ?? null,
      linesJson: JSON.stringify(figures.lines),
      source: s.source,
      sourceNote: s.sourceNote ?? null,
      verificationStatus: s.verificationStatus,
      verifiedById: s.verifiedById ?? null,
      verifiedAt: s.verifiedAt ?? null,
      updatedById: s.updatedById,
    };
    try {
      await this.prisma.periodFinancialSummary.upsert({
        where: { reportingPeriodId: s.reportingPeriodId },
        create: { id: s.id, tenantId: s.tenantIdValue, projectId: s.projectId, reportingPeriodId: s.reportingPeriodId, createdById: s.createdById, ...data },
        update: data,
      });
      return ok(s);
    } catch (e) {
      return err(e);
    }
  }
}
