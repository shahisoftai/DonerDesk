import type { BudgetExpenseRecord, BudgetLineRecord, IBudgetRepository } from "@donordesk/application";
import { DomainError, ok } from "@donordesk/domain";
import type { Result, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

/** Budget lines and expenses on planned activities (phase 28.1-D). */
export class PrismaBudgetRepository implements IBudgetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async addLine(l: BudgetLineRecord): Promise<Result<void, DomainError>> {
    await this.prisma.budgetLine.create({
      data: { id: l.id, tenantId: l.tenantId, projectId: l.projectId, plannedActivityId: l.plannedActivityId, code: l.code, category: l.category, description: l.description, donorName: l.donorName, currency: l.currency, amountMinor: l.amountMinor, createdById: l.createdById, createdAt: l.createdAt },
    });
    return ok(undefined);
  }

  async countLines(plannedActivityId: string, tenantId: TenantId): Promise<Result<number, DomainError>> {
    return ok(await this.prisma.budgetLine.count({ where: { tenantId: tenantId.toString(), plannedActivityId } }));
  }

  async findLineById(id: string, tenantId: TenantId): Promise<Result<BudgetLineRecord | null, DomainError>> {
    const r = await this.prisma.budgetLine.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(r ? PrismaBudgetRepository.line(r) : null);
  }

  async findLinesByItem(plannedActivityId: string, tenantId: TenantId): Promise<Result<BudgetLineRecord[], DomainError>> {
    const rows = await this.prisma.budgetLine.findMany({ where: { tenantId: tenantId.toString(), plannedActivityId }, orderBy: { createdAt: "asc" } });
    return ok(rows.map(PrismaBudgetRepository.line));
  }

  async findLinesByProject(projectId: string, tenantId: TenantId): Promise<Result<BudgetLineRecord[], DomainError>> {
    const rows = await this.prisma.budgetLine.findMany({ where: { tenantId: tenantId.toString(), projectId }, orderBy: { createdAt: "asc" } });
    return ok(rows.map(PrismaBudgetRepository.line));
  }

  async addExpense(e: BudgetExpenseRecord): Promise<Result<void, DomainError>> {
    await this.prisma.budgetExpense.create({
      data: { id: e.id, tenantId: e.tenantId, projectId: e.projectId, budgetLineId: e.budgetLineId, expenseDate: new Date(`${e.expenseDate}T00:00:00.000Z`), amountMinor: e.amountMinor, description: e.description, createdById: e.createdById, createdAt: e.createdAt },
    });
    return ok(undefined);
  }

  async findExpensesByLines(lineIds: string[], tenantId: TenantId): Promise<Result<BudgetExpenseRecord[], DomainError>> {
    if (lineIds.length === 0) return ok([]);
    const rows = await this.prisma.budgetExpense.findMany({ where: { tenantId: tenantId.toString(), budgetLineId: { in: lineIds } } });
    return ok(rows.map((r) => ({
      id: r.id, tenantId: r.tenantId, projectId: r.projectId, budgetLineId: r.budgetLineId, expenseDate: r.expenseDate.toISOString().slice(0, 10),
      amountMinor: r.amountMinor, description: r.description, createdById: r.createdById, createdAt: r.createdAt,
    })));
  }

  private static line(r: { id: string; tenantId: string; projectId: string; plannedActivityId: string; code: string; category: string; description: string; donorName: string; currency: string; amountMinor: number; createdById: string; createdAt: Date }): BudgetLineRecord {
    return { id: r.id, tenantId: r.tenantId, projectId: r.projectId, plannedActivityId: r.plannedActivityId, code: r.code, category: r.category, description: r.description, donorName: r.donorName, currency: r.currency, amountMinor: r.amountMinor, createdById: r.createdById, createdAt: r.createdAt };
  }
}
