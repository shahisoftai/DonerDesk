import type { PrismaClient } from "@prisma/client";
import { TenantId, ok, type Amount, type Result } from "@donordesk/domain";
import type {
  Decision, FinanceSettings, IAdvanceRepository, IBudgetCategoryRepository, ICurrencyRateRepository, IDeliverableRepository, IDisbursementRepository, IFinanceSettingsRepository,
  IFundingSourceRepository, IProjectFundingRepository, IRegisterExpenseRepository, StoredAdvance, StoredBudgetCategory, StoredCurrencyRate, StoredDeliverable, StoredDisbursement,
  StoredFundingSource, StoredProjectFunding, StoredRegisterExpense,
} from "@donordesk/application";

/** Prisma adapters of the finance register ports. Amounts are BIGINT minor units in the database and plain numbers (below 2^53) in the domain. */
const day = (d: Date): string => d.toISOString().slice(0, 10);
const asDate = (s: string): Date => new Date(`${s}T00:00:00Z`);
const big = (n: number): bigint => BigInt(Math.round(n));
const status = (s: string): "DRAFT" | "APPROVED" | "REJECTED" => (s === "APPROVED" || s === "REJECTED" ? s : "DRAFT");

export class PrismaFundingSourceRepository implements IFundingSourceRepository {
  constructor(private readonly prisma: PrismaClient) {}
  private map = (r: { id: string; tenantId: string; name: string; ownFunding: boolean; archived: boolean; createdById: string; createdAt: Date }): StoredFundingSource => ({ ...r, tenantId: TenantId.create(r.tenantId) });
  async list(tenantId: TenantId): Promise<Result<StoredFundingSource[]>> { return ok((await this.prisma.fundingSource.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { name: "asc" } })).map(this.map)); }
  async findById(id: string, tenantId: TenantId): Promise<Result<StoredFundingSource | null>> { const r = await this.prisma.fundingSource.findFirst({ where: { id, tenantId: tenantId.toString() } }); return ok(r ? this.map(r) : null); }
  async create(s: StoredFundingSource): Promise<Result<void>> { await this.prisma.fundingSource.create({ data: { id: s.id, tenantId: s.tenantId.toString(), name: s.name, ownFunding: s.ownFunding, archived: s.archived, createdById: s.createdById } }); return ok(undefined); }
  async update(id: string, tenantId: TenantId, patch: { ownFunding?: boolean; archived?: boolean }): Promise<Result<void>> {
    await this.prisma.fundingSource.updateMany({ where: { id, tenantId: tenantId.toString() }, data: { ...(patch.ownFunding !== undefined ? { ownFunding: patch.ownFunding } : {}), ...(patch.archived !== undefined ? { archived: patch.archived } : {}) } });
    return ok(undefined);
  }
}

export class PrismaProjectFundingRepository implements IProjectFundingRepository {
  constructor(private readonly prisma: PrismaClient) {}
  private map = (r: { id: string; tenantId: string; projectId: string; fundingSourceId: string; allocatedOn: Date; amountMinor: bigint; currency: string; note: string; createdById: string }): StoredProjectFunding => ({
    id: r.id, tenantId: TenantId.create(r.tenantId), projectId: r.projectId, fundingSourceId: r.fundingSourceId, date: day(r.allocatedOn), amount: { minor: Number(r.amountMinor), currency: r.currency }, note: r.note, createdById: r.createdById,
  });
  async listForProjects(projectIds: string[], tenantId: TenantId): Promise<Result<StoredProjectFunding[]>> { return ok(projectIds.length === 0 ? [] : (await this.prisma.projectFunding.findMany({ where: { projectId: { in: projectIds }, tenantId: tenantId.toString() } })).map(this.map)); }
  async listByProject(projectId: string, tenantId: TenantId): Promise<Result<StoredProjectFunding[]>> { return ok((await this.prisma.projectFunding.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: [{ allocatedOn: "asc" }, { id: "asc" }] })).map(this.map)); }
  async findById(id: string, tenantId: TenantId): Promise<Result<StoredProjectFunding | null>> { const r = await this.prisma.projectFunding.findFirst({ where: { id, tenantId: tenantId.toString() } }); return ok(r ? this.map(r) : null); }
  async create(f: StoredProjectFunding): Promise<Result<void>> { await this.prisma.projectFunding.create({ data: { id: f.id, tenantId: f.tenantId.toString(), projectId: f.projectId, fundingSourceId: f.fundingSourceId, allocatedOn: asDate(f.date), amountMinor: big(f.amount.minor), currency: f.amount.currency, note: f.note, createdById: f.createdById } }); return ok(undefined); }
  async delete(id: string, tenantId: TenantId): Promise<Result<void>> { await this.prisma.projectFunding.deleteMany({ where: { id, tenantId: tenantId.toString() } }); return ok(undefined); }
}

export class PrismaBudgetCategoryRepository implements IBudgetCategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async list(tenantId: TenantId): Promise<Result<StoredBudgetCategory[]>> { return ok((await this.prisma.budgetCategory.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { code: "asc" } })).map((r) => ({ id: r.id, tenantId: TenantId.create(r.tenantId), code: r.code, label: r.label, archived: r.archived, createdById: r.createdById }))); }
  async create(c: StoredBudgetCategory): Promise<Result<void>> { await this.prisma.budgetCategory.create({ data: { id: c.id, tenantId: c.tenantId.toString(), code: c.code, label: c.label, archived: c.archived, createdById: c.createdById } }); return ok(undefined); }
}

type DisbRow = { id: string; tenantId: string; projectId: string; fundingSourceId: string; paidOn: Date; amountMinor: bigint; currency: string; memo: string; status: string; decidedById: string | null; decidedAt: Date | null; decisionNote: string | null; createdById: string };
const disbFrom = (r: DisbRow): StoredDisbursement => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), projectId: r.projectId, fundingSourceId: r.fundingSourceId, date: day(r.paidOn), amount: { minor: Number(r.amountMinor), currency: r.currency }, memo: r.memo,
  status: status(r.status), ...(r.decidedById ? { decidedById: r.decidedById } : {}), ...(r.decidedAt ? { decidedAt: r.decidedAt } : {}), ...(r.decisionNote ? { decisionNote: r.decisionNote } : {}), createdById: r.createdById,
});

export class PrismaDisbursementRepository implements IDisbursementRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async listForProjects(projectIds: string[], tenantId: TenantId): Promise<Result<StoredDisbursement[]>> { return ok(projectIds.length === 0 ? [] : (await this.prisma.disbursement.findMany({ where: { projectId: { in: projectIds }, tenantId: tenantId.toString() } })).map(disbFrom)); }
  async listByProject(projectId: string, tenantId: TenantId): Promise<Result<StoredDisbursement[]>> { return ok((await this.prisma.disbursement.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: [{ paidOn: "asc" }, { id: "asc" }] })).map(disbFrom)); }
  async findById(id: string, tenantId: TenantId): Promise<Result<StoredDisbursement | null>> { const r = await this.prisma.disbursement.findFirst({ where: { id, tenantId: tenantId.toString() } }); return ok(r ? disbFrom(r) : null); }
  async updateDraft(id: string, tenantId: TenantId, p: { fundingSourceId: string; date: string; amount: Amount; memo: string }): Promise<Result<boolean>> {
    const done = await this.prisma.disbursement.updateMany({ where: { id, tenantId: tenantId.toString(), status: "DRAFT" }, data: { fundingSourceId: p.fundingSourceId, paidOn: asDate(p.date), amountMinor: big(p.amount.minor), currency: p.amount.currency, memo: p.memo } });
    return ok(done.count > 0);
  }
  async create(d: StoredDisbursement): Promise<Result<void>> { await this.prisma.disbursement.create({ data: { id: d.id, tenantId: d.tenantId.toString(), projectId: d.projectId, fundingSourceId: d.fundingSourceId, paidOn: asDate(d.date), amountMinor: big(d.amount.minor), currency: d.amount.currency, memo: d.memo, status: d.status, createdById: d.createdById } }); return ok(undefined); }
  async decide(id: string, tenantId: TenantId, x: Decision): Promise<Result<boolean>> {
    const done = await this.prisma.disbursement.updateMany({ where: { id, tenantId: tenantId.toString(), status: "DRAFT" }, data: { status: x.status, decidedById: x.byId, decidedAt: x.at, decisionNote: x.note || null } });
    return ok(done.count > 0);
  }
}

export class PrismaRegisterExpenseRepository implements IRegisterExpenseRepository {
  constructor(private readonly prisma: PrismaClient) {}
  private async currencies(projectId: string, tenantId: string): Promise<Map<string, string>> {
    const lines = await this.prisma.budgetLine.findMany({ where: { projectId, tenantId }, select: { id: true, currency: true } });
    return new Map(lines.map((l) => [l.id, l.currency]));
  }
  private from(r: { id: string; tenantId: string; projectId: string; budgetLineId: string; expenseDate: Date; amountMinor: bigint; currency: string | null; description: string; vendor: string; fundingSourceId: string | null; evidenceId: string | null; status: string; decidedById: string | null; decidedAt: Date | null; decisionNote: string | null; createdById: string }, lineCurrency: string): StoredRegisterExpense {
    return {
      id: r.id, tenantId: TenantId.create(r.tenantId), projectId: r.projectId, budgetLineId: r.budgetLineId, date: day(r.expenseDate), amount: { minor: Number(r.amountMinor), currency: r.currency ?? lineCurrency },
      vendor: r.vendor, memo: r.description, ...(r.fundingSourceId ? { fundingSourceId: r.fundingSourceId } : {}), ...(r.evidenceId ? { evidenceId: r.evidenceId } : {}), status: status(r.status),
      ...(r.decidedById ? { decidedById: r.decidedById } : {}), ...(r.decidedAt ? { decidedAt: r.decidedAt } : {}), ...(r.decisionNote ? { decisionNote: r.decisionNote } : {}), createdById: r.createdById,
    };
  }
  async listForProjects(projectIds: string[], tenantId: TenantId): Promise<Result<StoredRegisterExpense[]>> {
    if (projectIds.length === 0) return ok([]);
    const t = tenantId.toString();
    const [rows, lines] = await Promise.all([this.prisma.budgetExpense.findMany({ where: { projectId: { in: projectIds }, tenantId: t } }), this.prisma.budgetLine.findMany({ where: { projectId: { in: projectIds }, tenantId: t }, select: { id: true, currency: true } })]);
    const cur = new Map(lines.map((l) => [l.id, l.currency]));
    return ok(rows.map((r) => this.from(r, cur.get(r.budgetLineId) ?? "USD")));
  }
  async listByProject(projectId: string, tenantId: TenantId): Promise<Result<StoredRegisterExpense[]>> {
    const t = tenantId.toString();
    const [rows, cur] = await Promise.all([this.prisma.budgetExpense.findMany({ where: { projectId, tenantId: t }, orderBy: [{ expenseDate: "asc" }, { id: "asc" }] }), this.currencies(projectId, t)]);
    return ok(rows.map((r) => this.from(r, cur.get(r.budgetLineId) ?? "USD")));
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<StoredRegisterExpense | null>> {
    const r = await this.prisma.budgetExpense.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!r) return ok(null);
    const line = await this.prisma.budgetLine.findFirst({ where: { id: r.budgetLineId, tenantId: tenantId.toString() }, select: { currency: true } });
    return ok(this.from(r, line?.currency ?? "USD"));
  }
  async create(e: StoredRegisterExpense): Promise<Result<void>> {
    await this.prisma.budgetExpense.create({ data: {
      id: e.id, tenantId: e.tenantId.toString(), projectId: e.projectId, budgetLineId: e.budgetLineId, expenseDate: asDate(e.date), amountMinor: big(e.amount.minor), description: e.memo, vendor: e.vendor, currency: e.amount.currency,
      fundingSourceId: e.fundingSourceId ?? null, evidenceId: e.evidenceId ?? null, status: e.status, createdById: e.createdById,
    } });
    return ok(undefined);
  }
  async updateDraft(id: string, tenantId: TenantId, p: { date: string; amount: Amount; vendor: string; memo: string; fundingSourceId: string | null; evidenceId: string | null }): Promise<Result<boolean>> {
    const done = await this.prisma.budgetExpense.updateMany({ where: { id, tenantId: tenantId.toString(), status: "DRAFT" }, data: { expenseDate: asDate(p.date), amountMinor: big(p.amount.minor), currency: p.amount.currency, vendor: p.vendor, description: p.memo, fundingSourceId: p.fundingSourceId, evidenceId: p.evidenceId } });
    return ok(done.count > 0);
  }
  async decide(id: string, tenantId: TenantId, x: Decision): Promise<Result<boolean>> {
    const done = await this.prisma.budgetExpense.updateMany({ where: { id, tenantId: tenantId.toString(), status: "DRAFT" }, data: { status: x.status, decidedById: x.byId, decidedAt: x.at, decisionNote: x.note || null } });
    return ok(done.count > 0);
  }
}

export class PrismaDeliverableRepository implements IDeliverableRepository {
  constructor(private readonly prisma: PrismaClient) {}
  private map = (r: { id: string; tenantId: string; projectId: string; name: string; amountMinor: bigint; currency: string; dueOn: Date; approvedById: string | null; approvedAt: Date | null; paidOn: Date | null; createdById: string }): StoredDeliverable => ({
    id: r.id, tenantId: TenantId.create(r.tenantId), projectId: r.projectId, name: r.name, amount: { minor: Number(r.amountMinor), currency: r.currency }, dueOn: day(r.dueOn),
    ...(r.approvedById ? { approvedById: r.approvedById } : {}), ...(r.approvedAt ? { approvedAt: r.approvedAt } : {}), ...(r.paidOn ? { paidOn: day(r.paidOn) } : {}), createdById: r.createdById,
  });
  async listByProject(projectId: string, tenantId: TenantId): Promise<Result<StoredDeliverable[]>> { return ok((await this.prisma.deliverable.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: [{ dueOn: "asc" }, { id: "asc" }] })).map(this.map)); }
  async findById(id: string, tenantId: TenantId): Promise<Result<StoredDeliverable | null>> { const r = await this.prisma.deliverable.findFirst({ where: { id, tenantId: tenantId.toString() } }); return ok(r ? this.map(r) : null); }
  async create(d: StoredDeliverable): Promise<Result<void>> { await this.prisma.deliverable.create({ data: { id: d.id, tenantId: d.tenantId.toString(), projectId: d.projectId, name: d.name, amountMinor: big(d.amount.minor), currency: d.amount.currency, dueOn: asDate(d.dueOn), createdById: d.createdById } }); return ok(undefined); }
  async approve(id: string, tenantId: TenantId, byId: string, at: Date): Promise<Result<boolean>> { const x = await this.prisma.deliverable.updateMany({ where: { id, tenantId: tenantId.toString(), approvedAt: null }, data: { approvedById: byId, approvedAt: at } }); return ok(x.count > 0); }
  async markPaid(id: string, tenantId: TenantId, on: string): Promise<Result<boolean>> { const x = await this.prisma.deliverable.updateMany({ where: { id, tenantId: tenantId.toString(), paidOn: null, approvedAt: { not: null } }, data: { paidOn: asDate(on) } }); return ok(x.count > 0); }
}

export class PrismaAdvanceRepository implements IAdvanceRepository {
  constructor(private readonly prisma: PrismaClient) {}
  private from(a: { id: string; tenantId: string; projectId: string; heldBy: string; givenOn: Date; amountMinor: bigint; currency: string; note: string; createdById: string }, acc: Array<{ id: string; advanceId: string; accountedOn: Date; amountMinor: bigint; currency: string; note: string; createdById: string }>): StoredAdvance {
    return { id: a.id, tenantId: TenantId.create(a.tenantId), projectId: a.projectId, heldBy: a.heldBy, givenOn: day(a.givenOn), amount: { minor: Number(a.amountMinor), currency: a.currency }, note: a.note, createdById: a.createdById,
      accounted: acc.filter((x) => x.advanceId === a.id).map((x) => ({ id: x.id, advanceId: x.advanceId, date: day(x.accountedOn), amount: { minor: Number(x.amountMinor), currency: x.currency }, note: x.note, createdById: x.createdById })) };
  }
  async listByProject(projectId: string, tenantId: TenantId): Promise<Result<StoredAdvance[]>> {
    const t = tenantId.toString();
    const advances = await this.prisma.advance.findMany({ where: { projectId, tenantId: t }, orderBy: [{ givenOn: "asc" }, { id: "asc" }] });
    const acc = advances.length ? await this.prisma.advanceAccounting.findMany({ where: { tenantId: t, advanceId: { in: advances.map((a) => a.id) } }, orderBy: [{ accountedOn: "asc" }, { id: "asc" }] }) : [];
    return ok(advances.map((a) => this.from(a, acc)));
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<StoredAdvance | null>> {
    const t = tenantId.toString();
    const a = await this.prisma.advance.findFirst({ where: { id, tenantId: t } });
    if (!a) return ok(null);
    return ok(this.from(a, await this.prisma.advanceAccounting.findMany({ where: { tenantId: t, advanceId: id } })));
  }
  async create(a: Omit<StoredAdvance, "accounted">): Promise<Result<void>> { await this.prisma.advance.create({ data: { id: a.id, tenantId: a.tenantId.toString(), projectId: a.projectId, heldBy: a.heldBy, givenOn: asDate(a.givenOn), amountMinor: big(a.amount.minor), currency: a.amount.currency, note: a.note, createdById: a.createdById } }); return ok(undefined); }
  async addAccounting(tenantId: TenantId, a: StoredAdvance["accounted"][number]): Promise<Result<void>> { await this.prisma.advanceAccounting.create({ data: { id: a.id, tenantId: tenantId.toString(), advanceId: a.advanceId, accountedOn: asDate(a.date), amountMinor: big(a.amount.minor), currency: a.amount.currency, note: a.note, createdById: a.createdById } }); return ok(undefined); }
}

export class PrismaCurrencyRateRepository implements ICurrencyRateRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async list(tenantId: TenantId): Promise<Result<StoredCurrencyRate[]>> { return ok((await this.prisma.currencyRate.findMany({ where: { tenantId: tenantId.toString() }, orderBy: [{ effectiveOn: "asc" }, { id: "asc" }] })).map((r) => ({ id: r.id, tenantId: TenantId.create(r.tenantId), from: r.fromCurrency, to: r.toCurrency, rate: r.rate, effectiveOn: day(r.effectiveOn), source: r.source, enteredById: r.enteredById }))); }
  async add(r: StoredCurrencyRate): Promise<Result<void>> { await this.prisma.currencyRate.create({ data: { id: r.id, tenantId: r.tenantId.toString(), fromCurrency: r.from, toCurrency: r.to, rate: r.rate, effectiveOn: asDate(r.effectiveOn), source: r.source, enteredById: r.enteredById } }); return ok(undefined); }
}

export class PrismaFinanceSettingsRepository implements IFinanceSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async get(tenantId: TenantId): Promise<Result<FinanceSettings>> {
    const o = await this.prisma.organization.findFirst({ where: { tenantId: tenantId.toString() }, select: { primaryCurrency: true, localCurrency: true, financeSeparateApprover: true } });
    return ok({ primaryCurrency: o?.primaryCurrency ?? "USD", separateApprover: o?.financeSeparateApprover ?? false, ...(o?.localCurrency ? { localCurrency: o.localCurrency } : {}) });
  }
  async setSeparateApprover(tenantId: TenantId, on: boolean): Promise<Result<void>> { await this.prisma.organization.updateMany({ where: { tenantId: tenantId.toString() }, data: { financeSeparateApprover: on } }); return ok(undefined); }
  async set(tenantId: TenantId, s: { primaryCurrency: string; localCurrency?: string }): Promise<Result<void>> { await this.prisma.organization.updateMany({ where: { tenantId: tenantId.toString() }, data: { primaryCurrency: s.primaryCurrency, localCurrency: s.localCurrency ?? null } }); return ok(undefined); }
}
