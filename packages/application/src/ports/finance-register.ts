import type { Amount, EntryStatus, Result, TenantId } from "@donordesk/domain";

/** Ports of the finance register (Phase 35.F). Dates are plain days (YYYY-MM-DD); amounts are whole minor units with a currency. */

export interface StoredFundingSource { id: string; tenantId: TenantId; name: string; ownFunding: boolean; archived: boolean; createdById: string; createdAt: Date }
export interface IFundingSourceRepository {
  list(tenantId: TenantId): Promise<Result<StoredFundingSource[]>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredFundingSource | null>>;
  create(s: StoredFundingSource): Promise<Result<void>>;
  /** Only the fields given change. */
  update(id: string, tenantId: TenantId, patch: { ownFunding?: boolean; archived?: boolean }): Promise<Result<void>>;
}

export interface StoredProjectFunding { id: string; tenantId: TenantId; projectId: string; fundingSourceId: string; date: string; amount: Amount; note: string; createdById: string }
export interface IProjectFundingRepository {
  /** Several projects in one read (portfolio views). */
  listForProjects(projectIds: string[], tenantId: TenantId): Promise<Result<StoredProjectFunding[]>>;
  listByProject(projectId: string, tenantId: TenantId): Promise<Result<StoredProjectFunding[]>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredProjectFunding | null>>;
  create(f: StoredProjectFunding): Promise<Result<void>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
}

export interface StoredBudgetCategory { id: string; tenantId: TenantId; code: string; label: string; archived: boolean; createdById: string }
export interface IBudgetCategoryRepository {
  list(tenantId: TenantId): Promise<Result<StoredBudgetCategory[]>>;
  create(c: StoredBudgetCategory): Promise<Result<void>>;
}

export interface Decision { status: Exclude<EntryStatus, "DRAFT">; byId: string; at: Date; note: string }

export interface StoredDisbursement { id: string; tenantId: TenantId; projectId: string; fundingSourceId: string; date: string; amount: Amount; memo: string; status: EntryStatus; decidedById?: string; decidedAt?: Date; decisionNote?: string; createdById: string }
export interface IDisbursementRepository {
  listForProjects(projectIds: string[], tenantId: TenantId): Promise<Result<StoredDisbursement[]>>;
  listByProject(projectId: string, tenantId: TenantId): Promise<Result<StoredDisbursement[]>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredDisbursement | null>>;
  create(d: StoredDisbursement): Promise<Result<void>>;
  /** Decides a DRAFT only; false when it was already decided (so two people cannot both decide it). */
  decide(id: string, tenantId: TenantId, decision: Decision): Promise<Result<boolean>>;
}

export interface StoredRegisterExpense {
  id: string; tenantId: TenantId; projectId: string; budgetLineId: string; date: string; amount: Amount; vendor: string; memo: string;
  fundingSourceId?: string; evidenceId?: string; status: EntryStatus; decidedById?: string; decidedAt?: Date; decisionNote?: string; createdById: string;
}
export interface IRegisterExpenseRepository {
  listForProjects(projectIds: string[], tenantId: TenantId): Promise<Result<StoredRegisterExpense[]>>;
  listByProject(projectId: string, tenantId: TenantId): Promise<Result<StoredRegisterExpense[]>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredRegisterExpense | null>>;
  create(e: StoredRegisterExpense): Promise<Result<void>>;
  decide(id: string, tenantId: TenantId, decision: Decision): Promise<Result<boolean>>;
}

export interface StoredDeliverable { id: string; tenantId: TenantId; projectId: string; name: string; amount: Amount; dueOn: string; approvedById?: string; approvedAt?: Date; paidOn?: string; createdById: string }
export interface IDeliverableRepository {
  listByProject(projectId: string, tenantId: TenantId): Promise<Result<StoredDeliverable[]>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredDeliverable | null>>;
  create(d: StoredDeliverable): Promise<Result<void>>;
  approve(id: string, tenantId: TenantId, byId: string, at: Date): Promise<Result<boolean>>;
  markPaid(id: string, tenantId: TenantId, on: string): Promise<Result<boolean>>;
}

export interface StoredAdvanceAccounting { id: string; advanceId: string; date: string; amount: Amount; note: string; createdById: string }
export interface StoredAdvance { id: string; tenantId: TenantId; projectId: string; heldBy: string; givenOn: string; amount: Amount; note: string; createdById: string; accounted: StoredAdvanceAccounting[] }
export interface IAdvanceRepository {
  listByProject(projectId: string, tenantId: TenantId): Promise<Result<StoredAdvance[]>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredAdvance | null>>;
  create(a: Omit<StoredAdvance, "accounted">): Promise<Result<void>>;
  addAccounting(tenantId: TenantId, a: StoredAdvanceAccounting): Promise<Result<void>>;
}

export interface StoredCurrencyRate { id: string; tenantId: TenantId; from: string; to: string; rate: string; effectiveOn: string; source: string; enteredById: string }
export interface ICurrencyRateRepository {
  list(tenantId: TenantId): Promise<Result<StoredCurrencyRate[]>>;
  add(r: StoredCurrencyRate): Promise<Result<void>>;
}

export interface FinanceSettings { primaryCurrency: string; localCurrency?: string }
export interface IFinanceSettingsRepository {
  get(tenantId: TenantId): Promise<Result<FinanceSettings>>;
  set(tenantId: TenantId, settings: FinanceSettings): Promise<Result<void>>;
}
