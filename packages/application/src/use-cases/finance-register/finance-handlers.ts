import { createHash } from "node:crypto";
import {
  DomainError, Permissions, portfolioFinance, parseRegisterSheet, registerSheetErrorFile, advancePosition, budgetVsActual, burnReading, canEditEntry, checkAdvance, checkAdvanceAccounting, checkBudgetCategory, checkDeliverable, checkDeliverableChange,
  checkDisbursement, checkFundingSourceName, checkProjectFunding, checkRate, checkRegisterExpense, convertedTotal, deliverableState, financeIndex, registerRows, registerTotals,
  CURRENCY_CODE, type Amount, type PortfolioFinance, type Result, type Role, type TenantId,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IBudgetLineReader } from "../../ports/workplan.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import type {
  IAdvanceRepository, IBudgetCategoryRepository, ICurrencyRateRepository, IDeliverableRepository, IDisbursementRepository, IFinanceSettingsRepository, IFundingSourceRepository,
  IProjectFundingRepository, IRegisterExpenseRepository, StoredBudgetCategory, StoredCurrencyRate, StoredFundingSource,
} from "../../ports/finance-register.js";

/**
 * The finance register's handlers (Phase 35.F). Rules are in the domain (`contexts/finance`); a handler loads, checks the permission, applies a rule and writes.
 * Who may do what: organisation lists and rates need `org.manage`; project funding, disbursements, deliverables and advances are entered with `project.edit`;
 * an expense is entered with `workplan.update-own` (as budget expenses always were); approving or rejecting needs `finance.approve`. Entries are DRAFT until decided;
 * a decided entry is never edited, a correction is a new entry. Every change is audited.
 */
const can = (ctx: AuthenticatedContext, p: Parameters<typeof Permissions.can>[1]) => Permissions.can(ctx.tenant.role as Role, p);
const fail = <T>(error: DomainError): Result<T, DomainError> => ({ ok: false, error });
const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });
const forbid = <T>(what: string) => fail<T>(DomainError.forbidden(`You cannot ${what}`));
const dayOf = (d: Date): string => d.toISOString().slice(0, 10);

interface Deps { audit: IAuditLogger; clock: IClock; ids: IIdGenerator }
const note = (d: Deps, ctx: AuthenticatedContext, eventType: string, entityType: string, entityId: string, projectId?: string, newValue?: unknown) =>
  d.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType, entityType, entityId, ...(projectId ? { projectId } : {}), ...(newValue !== undefined ? { newValue: JSON.stringify(newValue) } : {}) });

async function liveProject(projects: IProjectRepository, ctx: AuthenticatedContext, id: string) {
  const p = await projects.findById(id, ctx.tenant.tenantId);
  if (!p.ok) return p;
  if (!p.value || p.value.archivedAt) return fail<never>(DomainError.notFound("Project", id));
  return ok(p.value);
}

// ---- Organisation lists and settings (org.manage) ---------------------------------------------------------------

export class ListFundingSourcesHandler {
  constructor(private readonly repo: IFundingSourceRepository) {}
  async handle(ctx: AuthenticatedContext) { if (!can(ctx, "project.view")) return forbid<StoredFundingSource[]>("see funding sources"); return this.repo.list(ctx.tenant.tenantId); }
}

export class CreateFundingSourceHandler {
  constructor(private readonly repo: IFundingSourceRepository, private readonly d: Deps) {}
  async handle(ctx: AuthenticatedContext, input: { name: string; ownFunding?: boolean }): Promise<Result<{ id: string }, DomainError>> {
    if (!can(ctx, "org.manage")) return forbid("add funding sources");
    const name = checkFundingSourceName(input.name);
    if (!name.ok) return name;
    const existing = await this.repo.list(ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    if (existing.value.some((s) => s.name.toLowerCase() === name.value.toLowerCase())) return fail(DomainError.conflict("A funding source with that name exists."));
    const id = this.d.ids.generate();
    const saved = await this.repo.create({ id, tenantId: ctx.tenant.tenantId, name: name.value, ownFunding: input.ownFunding ?? true, archived: false, createdById: ctx.tenant.userId, createdAt: this.d.clock.now() });
    if (!saved.ok) return saved;
    await note(this.d, ctx, "finance.funding_source_added", "funding_source", id, undefined, { name: name.value, ownFunding: input.ownFunding ?? true });
    return ok({ id });
  }
}

export class UpdateFundingSourceHandler {
  constructor(private readonly repo: IFundingSourceRepository, private readonly d: Deps) {}
  async handle(ctx: AuthenticatedContext, id: string, patch: { ownFunding?: boolean; archived?: boolean }): Promise<Result<void, DomainError>> {
    if (!can(ctx, "org.manage")) return forbid("change funding sources");
    const found = await this.repo.findById(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return fail(DomainError.notFound("FundingSource", id));
    const saved = await this.repo.update(id, ctx.tenant.tenantId, patch);
    if (!saved.ok) return saved;
    await note(this.d, ctx, "finance.funding_source_changed", "funding_source", id, undefined, patch);
    return ok(undefined);
  }
}

export class ListBudgetCategoriesHandler {
  constructor(private readonly repo: IBudgetCategoryRepository) {}
  async handle(ctx: AuthenticatedContext) { if (!can(ctx, "project.view")) return forbid<StoredBudgetCategory[]>("see budget categories"); return this.repo.list(ctx.tenant.tenantId); }
}

export class CreateBudgetCategoryHandler {
  constructor(private readonly repo: IBudgetCategoryRepository, private readonly d: Deps) {}
  async handle(ctx: AuthenticatedContext, input: { code: string; label: string }): Promise<Result<{ id: string }, DomainError>> {
    if (!can(ctx, "org.manage")) return forbid("add budget categories");
    const c = checkBudgetCategory(input);
    if (!c.ok) return c;
    const all = await this.repo.list(ctx.tenant.tenantId);
    if (!all.ok) return all;
    if (all.value.some((x) => x.code === c.value.code)) return fail(DomainError.conflict("A category with that code exists."));
    const id = this.d.ids.generate();
    const saved = await this.repo.create({ id, tenantId: ctx.tenant.tenantId, ...c.value, archived: false, createdById: ctx.tenant.userId });
    if (!saved.ok) return saved;
    await note(this.d, ctx, "finance.budget_category_added", "budget_category", id, undefined, c.value);
    return ok({ id });
  }
}

export class ListCurrencyRatesHandler {
  constructor(private readonly rates: ICurrencyRateRepository, private readonly settings: IFinanceSettingsRepository) {}
  async handle(ctx: AuthenticatedContext) {
    if (!can(ctx, "project.view")) return forbid<{ rates: StoredCurrencyRate[]; primaryCurrency: string; localCurrency?: string }>("see currency rates");
    const [rates, settings] = await Promise.all([this.rates.list(ctx.tenant.tenantId), this.settings.get(ctx.tenant.tenantId)]);
    if (!rates.ok) return rates;
    if (!settings.ok) return settings;
    return ok({ rates: rates.value, ...settings.value });
  }
}

/** A rate is added, never edited or deleted: a later-dated rate supersedes it, so a figure converted yesterday can be explained tomorrow. */
export class AddCurrencyRateHandler {
  constructor(private readonly rates: ICurrencyRateRepository, private readonly d: Deps) {}
  async handle(ctx: AuthenticatedContext, input: { from: string; to: string; rate: string; effectiveOn: string; source?: string }): Promise<Result<{ id: string }, DomainError>> {
    if (!can(ctx, "org.manage")) return forbid("enter currency rates");
    const from = input.from.trim().toUpperCase(), to = input.to.trim().toUpperCase();
    const problem = checkRate({ from, to, rate: input.rate.trim(), effectiveOn: input.effectiveOn.trim() });
    if (problem) return fail(DomainError.validation(problem));
    const id = this.d.ids.generate();
    const saved = await this.rates.add({ id, tenantId: ctx.tenant.tenantId, from, to, rate: input.rate.trim(), effectiveOn: input.effectiveOn.trim(), source: (input.source ?? "").trim().slice(0, 160), enteredById: ctx.tenant.userId });
    if (!saved.ok) return saved;
    await note(this.d, ctx, "finance.rate_added", "currency_rate", id, undefined, { from, to, rate: input.rate, effectiveOn: input.effectiveOn });
    return ok({ id });
  }
}

export class SetFinanceCurrenciesHandler {
  constructor(private readonly settings: IFinanceSettingsRepository, private readonly d: Deps) {}
  async handle(ctx: AuthenticatedContext, input: { primaryCurrency: string; localCurrency?: string }): Promise<Result<void, DomainError>> {
    if (!can(ctx, "org.manage")) return forbid("change the organisation's currencies");
    const primary = input.primaryCurrency.trim().toUpperCase();
    const local = input.localCurrency?.trim().toUpperCase() || undefined;
    if (!CURRENCY_CODE.test(primary) || (local !== undefined && !CURRENCY_CODE.test(local))) return fail(DomainError.validation("Use three-letter currency codes, such as USD."));
    const saved = await this.settings.set(ctx.tenant.tenantId, { primaryCurrency: primary, ...(local ? { localCurrency: local } : {}) });
    if (!saved.ok) return saved;
    await note(this.d, ctx, "finance.currencies_set", "organization", ctx.tenant.tenantId.toString(), undefined, { primary, local });
    return ok(undefined);
  }
}

// ---- Project entries ---------------------------------------------------------------------------------------------

export class AddProjectFundingHandler {
  constructor(private readonly projects: IProjectRepository, private readonly sources: IFundingSourceRepository, private readonly repo: IProjectFundingRepository, private readonly d: Deps) {}
  async handle(ctx: AuthenticatedContext, projectId: string, input: Parameters<typeof checkProjectFunding>[0]): Promise<Result<{ id: string }, DomainError>> {
    if (!can(ctx, "project.edit")) return forbid("record project funding");
    const project = await liveProject(this.projects, ctx, projectId);
    if (!project.ok) return project;
    const f = checkProjectFunding(input);
    if (!f.ok) return f;
    const source = await this.sources.findById(f.value.fundingSourceId, ctx.tenant.tenantId);
    if (!source.ok) return source;
    if (!source.value || source.value.archived) return fail(DomainError.validation("Choose a funding source from the list.", { field: "fundingSourceId" }));
    const id = this.d.ids.generate();
    const saved = await this.repo.create({ id, tenantId: ctx.tenant.tenantId, projectId, ...f.value, createdById: ctx.tenant.userId });
    if (!saved.ok) return saved;
    await note(this.d, ctx, "finance.funding_added", "project_funding", id, projectId, { source: source.value.name, amount: f.value.amount });
    return ok({ id });
  }
}

export class RemoveProjectFundingHandler {
  constructor(private readonly repo: IProjectFundingRepository, private readonly d: Deps) {}
  async handle(ctx: AuthenticatedContext, projectId: string, id: string): Promise<Result<void, DomainError>> {
    if (!can(ctx, "project.edit")) return forbid("remove project funding");
    const found = await this.repo.findById(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value || found.value.projectId !== projectId) return fail(DomainError.notFound("ProjectFunding", id));
    const gone = await this.repo.delete(id, ctx.tenant.tenantId);
    if (!gone.ok) return gone;
    await note(this.d, ctx, "finance.funding_removed", "project_funding", id, found.value.projectId, { amount: found.value.amount });
    return ok(undefined);
  }
}

export class AddDisbursementHandler {
  constructor(private readonly projects: IProjectRepository, private readonly sources: IFundingSourceRepository, private readonly repo: IDisbursementRepository, private readonly d: Deps) {}
  async handle(ctx: AuthenticatedContext, projectId: string, input: Parameters<typeof checkDisbursement>[0]): Promise<Result<{ id: string }, DomainError>> {
    if (!can(ctx, "project.edit")) return forbid("record disbursements");
    const project = await liveProject(this.projects, ctx, projectId);
    if (!project.ok) return project;
    const x = checkDisbursement(input);
    if (!x.ok) return x;
    const source = await this.sources.findById(x.value.fundingSourceId, ctx.tenant.tenantId);
    if (!source.ok) return source;
    if (!source.value || source.value.archived) return fail(DomainError.validation("Choose a funding source from the list.", { field: "fundingSourceId" }));
    const id = this.d.ids.generate();
    const saved = await this.repo.create({ id, tenantId: ctx.tenant.tenantId, projectId, ...x.value, status: "DRAFT", createdById: ctx.tenant.userId });
    if (!saved.ok) return saved;
    await note(this.d, ctx, "finance.disbursement_entered", "disbursement", id, projectId, { amount: x.value.amount });
    return ok({ id });
  }
}

export class AddRegisterExpenseHandler {
  constructor(private readonly projects: IProjectRepository, private readonly lines: IBudgetLineReader, private readonly sources: IFundingSourceRepository, private readonly repo: IRegisterExpenseRepository, private readonly d: Deps) {}
  async handle(ctx: AuthenticatedContext, projectId: string, budgetLineId: string, input: Parameters<typeof checkRegisterExpense>[0]): Promise<Result<{ id: string }, DomainError>> {
    if (!can(ctx, "workplan.update-own")) return forbid("record expenses");
    const project = await liveProject(this.projects, ctx, projectId);
    if (!project.ok) return project;
    const line = await this.lines.findLineById(budgetLineId, ctx.tenant.tenantId);
    if (!line.ok) return line;
    if (!line.value || line.value.projectId !== projectId) return fail(DomainError.notFound("BudgetLine", budgetLineId));
    const e = checkRegisterExpense(input, line.value.currency);
    if (!e.ok) return e;
    if (e.value.fundingSourceId) {
      const source = await this.sources.findById(e.value.fundingSourceId, ctx.tenant.tenantId);
      if (!source.ok) return source;
      if (!source.value) return fail(DomainError.validation("Choose a funding source from the list.", { field: "fundingSourceId" }));
    }
    const id = this.d.ids.generate();
    const saved = await this.repo.create({ id, tenantId: ctx.tenant.tenantId, projectId, budgetLineId, date: e.value.date, amount: e.value.amount, vendor: e.value.vendor, memo: e.value.memo, ...(e.value.fundingSourceId ? { fundingSourceId: e.value.fundingSourceId } : {}), ...(e.value.evidenceId ? { evidenceId: e.value.evidenceId } : {}), status: "DRAFT", createdById: ctx.tenant.userId });
    if (!saved.ok) return saved;
    await note(this.d, ctx, "finance.expense_entered", "expense", id, projectId, { amount: e.value.amount, vendor: e.value.vendor });
    return ok({ id });
  }
}

/** Approve or reject a draft expense or disbursement (`finance.approve`). A decided entry stays as it is; a second decision is refused. */
export class DecideEntryHandler {
  constructor(private readonly expenses: IRegisterExpenseRepository, private readonly disbursements: IDisbursementRepository, private readonly d: Deps) {}
  async handle(ctx: AuthenticatedContext, projectId: string, kind: "EXPENSE" | "DISBURSEMENT", id: string, input: { decision: "APPROVED" | "REJECTED"; note?: string }): Promise<Result<void, DomainError>> {
    if (!can(ctx, "finance.approve")) return forbid("approve or reject finance entries");
    const reason = (input.note ?? "").trim().slice(0, 300);
    if (input.decision === "REJECTED" && reason === "") return fail(DomainError.validation("Say why it is rejected.", { field: "note" }));
    const found = kind === "EXPENSE" ? await this.expenses.findById(id, ctx.tenant.tenantId) : await this.disbursements.findById(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value || found.value.projectId !== projectId) return fail(DomainError.notFound(kind === "EXPENSE" ? "Expense" : "Disbursement", id));
    if (!canEditEntry(found.value.status)) return fail(DomainError.conflict("This entry has already been decided."));
    const decision = { status: input.decision, byId: ctx.tenant.userId, at: this.d.clock.now(), note: reason } as const;
    const done = kind === "EXPENSE" ? await this.expenses.decide(id, ctx.tenant.tenantId, decision) : await this.disbursements.decide(id, ctx.tenant.tenantId, decision);
    if (!done.ok) return done;
    if (!done.value) return fail(DomainError.conflict("This entry has already been decided."));
    await note(this.d, ctx, input.decision === "APPROVED" ? "finance.entry_approved" : "finance.entry_rejected", kind === "EXPENSE" ? "expense" : "disbursement", id, found.value.projectId, { note: reason });
    return ok(undefined);
  }
}

export class AddDeliverableHandler {
  constructor(private readonly projects: IProjectRepository, private readonly repo: IDeliverableRepository, private readonly d: Deps) {}
  async handle(ctx: AuthenticatedContext, projectId: string, input: Parameters<typeof checkDeliverable>[0]): Promise<Result<{ id: string }, DomainError>> {
    if (!can(ctx, "project.edit")) return forbid("add deliverables");
    const project = await liveProject(this.projects, ctx, projectId);
    if (!project.ok) return project;
    const x = checkDeliverable(input);
    if (!x.ok) return x;
    const id = this.d.ids.generate();
    const saved = await this.repo.create({ id, tenantId: ctx.tenant.tenantId, projectId, ...x.value, createdById: ctx.tenant.userId });
    if (!saved.ok) return saved;
    await note(this.d, ctx, "finance.deliverable_added", "deliverable", id, projectId, { name: x.value.name, amount: x.value.amount });
    return ok({ id });
  }
}

/** Approval records who and when; payment follows approval. `separateApprover` is the organisation's choice (off by default here: a small team may be one person). */
export class ChangeDeliverableHandler {
  constructor(private readonly repo: IDeliverableRepository, private readonly d: Deps, private readonly separateApprover = false) {}
  async handle(ctx: AuthenticatedContext, projectId: string, id: string, change: { action: "APPROVE" } | { action: "PAY"; on: string }): Promise<Result<void, DomainError>> {
    const found = await this.repo.findById(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value || found.value.projectId !== projectId) return fail(DomainError.notFound("Deliverable", id));
    const dl = found.value;
    const current = { id: dl.id, name: dl.name, amount: dl.amount, dueOn: dl.dueOn, ...(dl.approvedById ? { approvedById: dl.approvedById } : {}), ...(dl.approvedAt ? { approvedAt: dl.approvedAt.toISOString() } : {}), ...(dl.paidOn ? { paidOn: dl.paidOn } : {}) };
    if (change.action === "APPROVE") {
      if (!can(ctx, "finance.approve")) return forbid("approve deliverables");
      const now = this.d.clock.now();
      const problem = checkDeliverableChange(current, { approve: true, byId: ctx.tenant.userId, at: now.toISOString(), createdById: dl.createdById, separateApprover: this.separateApprover });
      if (problem) return fail(DomainError.validation(problem));
      const done = await this.repo.approve(id, ctx.tenant.tenantId, ctx.tenant.userId, now);
      if (!done.ok) return done;
      if (!done.value) return fail(DomainError.conflict("This deliverable is already approved."));
      await note(this.d, ctx, "finance.deliverable_approved", "deliverable", id, dl.projectId);
      return ok(undefined);
    }
    if (!can(ctx, "project.edit")) return forbid("mark deliverables as paid");
    const problem = checkDeliverableChange(current, { pay: true, on: change.on });
    if (problem) return fail(DomainError.validation(problem));
    const done = await this.repo.markPaid(id, ctx.tenant.tenantId, change.on);
    if (!done.ok) return done;
    if (!done.value) return fail(DomainError.conflict("This deliverable cannot be marked as paid."));
    await note(this.d, ctx, "finance.deliverable_paid", "deliverable", id, dl.projectId, { on: change.on });
    return ok(undefined);
  }
}

export class AddAdvanceHandler {
  constructor(private readonly projects: IProjectRepository, private readonly repo: IAdvanceRepository, private readonly d: Deps) {}
  async handle(ctx: AuthenticatedContext, projectId: string, input: Parameters<typeof checkAdvance>[0]): Promise<Result<{ id: string }, DomainError>> {
    if (!can(ctx, "project.edit")) return forbid("record advances");
    const project = await liveProject(this.projects, ctx, projectId);
    if (!project.ok) return project;
    const x = checkAdvance(input);
    if (!x.ok) return x;
    const id = this.d.ids.generate();
    const saved = await this.repo.create({ id, tenantId: ctx.tenant.tenantId, projectId, ...x.value, createdById: ctx.tenant.userId });
    if (!saved.ok) return saved;
    await note(this.d, ctx, "finance.advance_given", "advance", id, projectId, { heldBy: x.value.heldBy, amount: x.value.amount });
    return ok({ id });
  }
}

export class AccountForAdvanceHandler {
  constructor(private readonly repo: IAdvanceRepository, private readonly d: Deps) {}
  async handle(ctx: AuthenticatedContext, projectId: string, advanceId: string, input: { date: string; amount: string; currency: string; note?: string }): Promise<Result<{ id: string }, DomainError>> {
    if (!can(ctx, "project.edit")) return forbid("account for advances");
    const advance = await this.repo.findById(advanceId, ctx.tenant.tenantId);
    if (!advance.ok) return advance;
    if (!advance.value || advance.value.projectId !== projectId) return fail(DomainError.notFound("Advance", advanceId));
    const x = checkAdvanceAccounting(input, { givenOn: advance.value.givenOn, currency: advance.value.amount.currency });
    if (!x.ok) return x;
    const id = this.d.ids.generate();
    const saved = await this.repo.addAccounting(ctx.tenant.tenantId, { id, advanceId, ...x.value, createdById: ctx.tenant.userId });
    if (!saved.ok) return saved;
    await note(this.d, ctx, "finance.advance_accounted", "advance", advanceId, advance.value.projectId, { amount: x.value.amount });
    return ok({ id });
  }
}

// ---- The read model -----------------------------------------------------------------------------------------------

const amountDto = (a: Amount) => ({ minor: a.minor, currency: a.currency });

export interface ProjectFinanceDto {
  primaryCurrency: string;
  funding: Array<{ id: string; sourceId: string; sourceName: string; ownFunding: boolean; date: string; amount: Amount; note: string }>;
  index: ReturnType<typeof financeIndex>;
  /** Obligated, disbursed and spent in the primary currency: null when any amount lacks a dated rate (the amounts missing one are named). */
  inPrimary: Record<"obligated" | "disbursed" | "spent", { total: Amount | null; needsRate: Array<{ date: string; amount: Amount }> }>;
  register: ReturnType<typeof registerRows> extends Array<infer R> ? Array<R & { status: string; vendor?: string; sourceId?: string; hasEvidence?: boolean; budgetLineId?: string; canDecide: boolean }> : never;
  totals: ReturnType<typeof registerTotals>;
  advances: Array<{ id: string; heldBy: string; givenOn: string; amount: Amount; note: string; position: ReturnType<typeof advancePosition> }>;
  deliverables: Array<{ id: string; name: string; amount: Amount; dueOn: string; state: ReturnType<typeof deliverableState>; approvedAt?: string; paidOn?: string }>;
  budgetLines: Array<ReturnType<typeof budgetVsActual>[number] & { description: string; category: string; otherCurrencySpent: number }>;
  burn: ReturnType<typeof burnReading> | null;
  sources: Array<{ id: string; name: string; ownFunding: boolean; archived: boolean }>;
}

export class GetProjectFinanceHandler {
  constructor(
    private readonly projects: IProjectRepository, private readonly lines: IBudgetLineReader, private readonly sources: IFundingSourceRepository, private readonly fundings: IProjectFundingRepository,
    private readonly disbursements: IDisbursementRepository, private readonly expenses: IRegisterExpenseRepository, private readonly advances: IAdvanceRepository,
    private readonly deliverables: IDeliverableRepository, private readonly rates: ICurrencyRateRepository, private readonly settings: IFinanceSettingsRepository, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<ProjectFinanceDto, DomainError>> {
    if (!can(ctx, "project.view")) return forbid("see project finance");
    const t: TenantId = ctx.tenant.tenantId;
    const project = await liveProject(this.projects, ctx, projectId);
    if (!project.ok) return project;
    const [src, fund, disb, exp, adv, del, rates, settings, lines] = await Promise.all([
      this.sources.list(t), this.fundings.listByProject(projectId, t), this.disbursements.listByProject(projectId, t), this.expenses.listByProject(projectId, t), this.advances.listByProject(projectId, t),
      this.deliverables.listByProject(projectId, t), this.rates.list(t), this.settings.get(t), this.lines.findLinesByProject(projectId, t),
    ]);
    for (const r of [src, fund, disb, exp, adv, del, rates, settings, lines]) if (!r.ok) return r as Result<never, DomainError>;
    if (!src.ok || !fund.ok || !disb.ok || !exp.ok || !adv.ok || !del.ok || !rates.ok || !settings.ok || !lines.ok) return fail(DomainError.notFound("Project", projectId));
    const today = dayOf(this.clock.now());
    const primary = settings.value.primaryCurrency;
    const sourceById = new Map(src.value.map((s) => [s.id, s]));
    const rateList = rates.value.map((r) => ({ id: r.id, from: r.from, to: r.to, rate: r.rate, effectiveOn: r.effectiveOn, source: r.source }));
    const expenseList = exp.value.map((e) => ({ id: e.id, budgetLineId: e.budgetLineId, date: e.date, vendor: e.vendor, amount: e.amount, status: e.status, evidenceId: e.evidenceId, memo: e.memo }));
    const disbList = disb.value.map((d) => ({ id: d.id, fundingSourceId: d.fundingSourceId, date: d.date, amount: d.amount, status: d.status, memo: d.memo }));
    const fundingList = fund.value.map((f) => ({ id: f.id, fundingSourceId: f.fundingSourceId, date: f.date, amount: f.amount }));
    const sourceList = src.value.map((s) => ({ id: s.id, name: s.name, ownFunding: s.ownFunding }));
    const index = financeIndex({ sources: sourceList, fundings: fundingList, disbursements: disbList, expenses: expenseList });
    const own = new Set(src.value.filter((s) => s.ownFunding).map((s) => s.id));
    const inPrimary = {
      obligated: convertedTotal(fund.value.filter((f) => own.has(f.fundingSourceId)).map((f) => ({ date: f.date, amount: f.amount })), primary, rateList),
      disbursed: convertedTotal(disb.value.filter((d) => d.status === "APPROVED" && own.has(d.fundingSourceId)).map((d) => ({ date: d.date, amount: d.amount })), primary, rateList),
      spent: convertedTotal(exp.value.filter((e) => e.status === "APPROVED").map((e) => ({ date: e.date, amount: e.amount })), primary, rateList),
    };
    const byLineSpent = new Map<string, number>();
    const otherCurrency = new Map<string, number>();
    for (const e of exp.value) {
      if (e.status !== "APPROVED") continue;
      const line = lines.value.find((l) => l.id === e.budgetLineId);
      if (!line) continue;
      if (e.amount.currency === line.currency) byLineSpent.set(line.id, (byLineSpent.get(line.id) ?? 0) + e.amount.minor);
      else otherCurrency.set(line.id, (otherCurrency.get(line.id) ?? 0) + 1);
    }
    const rows = registerRows({ expenses: expenseList.map((e) => ({ ...e, evidenceId: e.evidenceId })), disbursements: disbList, today });
    const meta = new Map<string, { status: string; vendor?: string; sourceId?: string; hasEvidence?: boolean; budgetLineId?: string }>();
    for (const e of exp.value) meta.set(e.id, { status: e.status, vendor: e.vendor, ...(e.fundingSourceId ? { sourceId: e.fundingSourceId } : {}), hasEvidence: !!e.evidenceId, budgetLineId: e.budgetLineId });
    for (const d of disb.value) meta.set(d.id, { status: d.status, sourceId: d.fundingSourceId });
    const canDecide = can(ctx, "finance.approve");
    const budget = project.value.budget;
    const budgetMinor = budget ? Math.round(budget.amount * 100) : null;
    const spentInBudgetCurrency = budget ? index.spent.find((s) => s.currency === budget.currency)?.minor ?? 0 : 0;
    return ok({
      primaryCurrency: primary,
      funding: fund.value.map((f) => ({ id: f.id, sourceId: f.fundingSourceId, sourceName: sourceById.get(f.fundingSourceId)?.name ?? "A funding source that was removed", ownFunding: sourceById.get(f.fundingSourceId)?.ownFunding ?? false, date: f.date, amount: amountDto(f.amount), note: f.note })),
      index, inPrimary,
      register: rows.map((r) => ({ ...r, status: meta.get(r.id)?.status ?? "DRAFT", ...(meta.get(r.id)?.vendor !== undefined ? { vendor: meta.get(r.id)!.vendor! } : {}), ...(meta.get(r.id)?.sourceId ? { sourceId: meta.get(r.id)!.sourceId! } : {}), hasEvidence: meta.get(r.id)?.hasEvidence ?? false, ...(meta.get(r.id)?.budgetLineId ? { budgetLineId: meta.get(r.id)!.budgetLineId! } : {}), canDecide: canDecide && meta.get(r.id)?.status === "DRAFT" })) as ProjectFinanceDto["register"],
      totals: registerTotals({ expenses: expenseList, disbursements: disbList, advances: adv.value.map((a) => ({ id: a.id, heldBy: a.heldBy, givenOn: a.givenOn, amount: a.amount, accounted: a.accounted.map((x) => ({ date: x.date, amount: x.amount })) })), today }),
      advances: adv.value.map((a) => ({ id: a.id, heldBy: a.heldBy, givenOn: a.givenOn, amount: amountDto(a.amount), note: a.note, position: advancePosition({ id: a.id, heldBy: a.heldBy, givenOn: a.givenOn, amount: a.amount, accounted: a.accounted.map((x) => ({ date: x.date, amount: x.amount })) }, today) })),
      deliverables: del.value.map((d) => {
        const base = { id: d.id, name: d.name, amount: d.amount, dueOn: d.dueOn, ...(d.approvedById ? { approvedById: d.approvedById } : {}), ...(d.approvedAt ? { approvedAt: d.approvedAt.toISOString() } : {}), ...(d.paidOn ? { paidOn: d.paidOn } : {}) };
        return { id: d.id, name: d.name, amount: amountDto(d.amount), dueOn: d.dueOn, state: deliverableState(base, today), ...(d.approvedAt ? { approvedAt: d.approvedAt.toISOString() } : {}), ...(d.paidOn ? { paidOn: d.paidOn } : {}) };
      }),
      budgetLines: budgetVsActual(lines.value.map((l) => ({ lineId: l.id, code: l.code, budget: { minor: l.amountMinor, currency: l.currency }, spentMinor: byLineSpent.get(l.id) ?? 0 }))).map((r) => {
        const l = lines.value.find((x) => x.id === r.lineId)!;
        return { ...r, description: l.description, category: l.category, otherCurrencySpent: otherCurrency.get(l.id) ?? 0 };
      }),
      burn: budget ? burnReading({ budgetMinor, spentMinor: spentInBudgetCurrency, start: dayOf(project.value.duration.start), end: dayOf(project.value.duration.end), today }) : null,
      sources: src.value.map((s) => ({ id: s.id, name: s.name, ownFunding: s.ownFunding, archived: s.archived })),
    });
  }
}

// ---- Import from a sheet ------------------------------------------------------------------------------------------------

export interface RegisterImportDto {
  /** Rows read (the template's hint row is not one). */
  rows: number;
  valid: number;
  invalid: number;
  unknownColumns: string[];
  missingColumns: string[];
  problems: Array<{ row: number; message: string }>;
  /** Entries stored by this call (0 for a check). */
  imported: number;
  /** Rows that an earlier import of the same sheet already stored. */
  alreadyThere: number;
  applied: boolean;
  /** The person's own sheet with a Problems column, only the rows to fix; present when anything is wrong. */
  errorFile?: string;
}

/**
 * Reads a sheet of expenses and money received (`apply: false` only checks). Any bad row blocks the whole import. Each row is stored as a DRAFT under
 * an id made from the sheet's own text and the row number, so importing the same sheet twice stores it once.
 */
export class ImportRegisterSheetHandler {
  constructor(
    private readonly projects: IProjectRepository, private readonly lines: IBudgetLineReader, private readonly sources: IFundingSourceRepository,
    private readonly expenses: IRegisterExpenseRepository, private readonly disbursements: IDisbursementRepository, private readonly settings: IFinanceSettingsRepository, private readonly d: Deps,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: { text: string; apply: boolean }): Promise<Result<RegisterImportDto, DomainError>> {
    if (!can(ctx, "workplan.update-own")) return forbid("import expenses");
    if (input.text.length > 2_000_000) return fail(DomainError.validation("That sheet is too large. Split it into smaller files."));
    const project = await liveProject(this.projects, ctx, projectId);
    if (!project.ok) return project;
    const t = ctx.tenant.tenantId;
    const [lines, sources, settings] = await Promise.all([this.lines.findLinesByProject(projectId, t), this.sources.list(t), this.settings.get(t)]);
    if (!lines.ok) return lines;
    if (!sources.ok) return sources;
    if (!settings.ok) return settings;
    const parsed = parseRegisterSheet(input.text, {
      lines: new Map(lines.value.map((l) => [l.code.toLowerCase(), { id: l.id, currency: l.currency }])),
      sources: new Map(sources.value.filter((s) => !s.archived).map((s) => [s.name.toLowerCase(), s.id])),
      primaryCurrency: settings.value.primaryCurrency,
    });
    const mayReceive = can(ctx, "project.edit");
    if (!mayReceive) for (const r of parsed.rows) if (r.entry?.kind === "DISBURSEMENT") { r.problems.push("You cannot record money received."); r.entry = null; }
    const invalid = parsed.rows.filter((r) => r.problems.length > 0).length;
    const result = { ...parsed, valid: parsed.rows.length - invalid, invalid };
    const problems = parsed.rows.flatMap((r) => r.problems.map((message) => ({ row: r.rowNumber, message })));
    const dto: RegisterImportDto = {
      rows: parsed.rows.length, valid: result.valid, invalid, unknownColumns: parsed.unknownColumns, missingColumns: parsed.missingColumns, problems, imported: 0, alreadyThere: 0, applied: false,
      ...(invalid > 0 ? { errorFile: registerSheetErrorFile(result) } : {}),
    };
    if (!input.apply || invalid > 0 || parsed.rows.length === 0) return ok(dto);

    const sheetKey = createHash("sha256").update(input.text).digest("hex").slice(0, 16);
    let imported = 0, alreadyThere = 0;
    for (const row of parsed.rows) {
      const e = row.entry!;
      const id = `imp-${sheetKey}-${row.rowNumber}`;
      const exists = e.kind === "EXPENSE" ? await this.expenses.findById(id, t) : await this.disbursements.findById(id, t);
      if (!exists.ok) return exists;
      if (exists.value) { alreadyThere += 1; continue; }
      const saved = e.kind === "EXPENSE"
        ? await this.expenses.create({ id, tenantId: t, projectId, budgetLineId: e.budgetLineId, date: e.date, amount: e.amount, vendor: e.vendor, memo: e.memo, ...(e.fundingSourceId ? { fundingSourceId: e.fundingSourceId } : {}), status: "DRAFT", createdById: ctx.tenant.userId })
        : await this.disbursements.create({ id, tenantId: t, projectId, fundingSourceId: e.fundingSourceId, date: e.date, amount: e.amount, memo: e.memo, status: "DRAFT", createdById: ctx.tenant.userId });
      if (!saved.ok) return saved;
      imported += 1;
    }
    await note(this.d, ctx, "finance.sheet_imported", "project", projectId, projectId, { imported, alreadyThere });
    return ok({ ...dto, imported, alreadyThere, applied: true });
  }
}

// ---- The portfolio ------------------------------------------------------------------------------------------------------

/** The money across every project the person can see (Home). Same rules as a project's index; reads only. */
export class GetPortfolioFinanceHandler {
  constructor(
    private readonly visible: VisibleProjects, private readonly sources: IFundingSourceRepository, private readonly fundings: IProjectFundingRepository, private readonly disbursements: IDisbursementRepository,
    private readonly expenses: IRegisterExpenseRepository, private readonly rates: ICurrencyRateRepository, private readonly settings: IFinanceSettingsRepository,
  ) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<PortfolioFinance & { primaryCurrency: string }, DomainError>> {
    if (!can(ctx, "project.view")) return forbid("see finance");
    const t = ctx.tenant.tenantId;
    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    const ids = mine.value.filter((p) => !p.archivedAt).map((p) => p.id);
    const [src, fund, disb, exp, rates, settings] = await Promise.all([this.sources.list(t), this.fundings.listForProjects(ids, t), this.disbursements.listForProjects(ids, t), this.expenses.listForProjects(ids, t), this.rates.list(t), this.settings.get(t)]);
    if (!src.ok) return src;
    if (!fund.ok) return fund;
    if (!disb.ok) return disb;
    if (!exp.ok) return exp;
    if (!rates.ok) return rates;
    if (!settings.ok) return settings;
    const p = portfolioFinance({
      projectIds: ids,
      sources: src.value.map((s) => ({ id: s.id, name: s.name, ownFunding: s.ownFunding })),
      fundings: fund.value.map((f) => ({ id: f.id, projectId: f.projectId, fundingSourceId: f.fundingSourceId, date: f.date, amount: f.amount })),
      disbursements: disb.value.map((d) => ({ id: d.id, fundingSourceId: d.fundingSourceId, date: d.date, amount: d.amount, status: d.status })),
      expenses: exp.value.map((e) => ({ id: e.id, date: e.date, vendor: e.vendor, amount: e.amount, status: e.status, ...(e.budgetLineId ? { budgetLineId: e.budgetLineId } : {}), ...(e.evidenceId ? { evidenceId: e.evidenceId } : {}) })),
      rates: rates.value.map((r) => ({ id: r.id, from: r.from, to: r.to, rate: r.rate, effectiveOn: r.effectiveOn, source: r.source })),
      primaryCurrency: settings.value.primaryCurrency,
    });
    return ok({ ...p, primaryCurrency: settings.value.primaryCurrency });
  }
}
