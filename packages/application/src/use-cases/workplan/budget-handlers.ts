import { DomainError, MAX_BUDGET_LINES, budgetPosition, checkBudgetLine, checkExpense, err, ok, projectBudgetSummary, type BudgetCostCategory, type BudgetPosition, type ProjectBudgetCurrency, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { BudgetExpenseRecord, BudgetLineRecord, IBudgetExpenseReader, IBudgetExpenseWriter, IBudgetLineReader, IBudgetLineWriter, IPlanContextReader, IPlannedActivityRepository } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";

export interface BudgetLineView {
  id: string;
  code: string;
  category: string;
  description: string;
  donorName: string;
  currency: string;
  position: BudgetPosition;
  expenses: Array<{ id: string; date: string; amountMinor: number; description: string }>;
}

/** A budget line on a planned activity. Managers only: the budget is set when the plan is made. */
export class AddBudgetLineHandler {
  constructor(private readonly access: PlanAccess, private readonly budgets: IBudgetLineWriter, private readonly ids: IIdGenerator, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: { code: string; category: BudgetCostCategory; description?: string; donorName?: string; currency: string; amount: string }): Promise<Result<{ id: string }, DomainError>> {
    const item = await this.access.load(ctx, itemId, "EDIT");
    if (!item.ok) return item;
    const count = await this.budgets.countLines(itemId, ctx.tenant.tenantId);
    if (!count.ok) return count;
    if (count.value >= MAX_BUDGET_LINES) return err(DomainError.validation(`An activity can have up to ${MAX_BUDGET_LINES} budget lines`));
    const line = checkBudgetLine(input);
    if (!line.ok) return line;
    const id = this.ids.generate();
    const saved = await this.budgets.addLine({
      id, tenantId: ctx.tenant.tenantId.toString(), projectId: item.value.projectId, plannedActivityId: itemId, ...line.value,
      createdById: ctx.tenant.userId, createdAt: this.clock.now(),
    });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "workplan.budget_line_added", entityType: "planned_activity", entityId: itemId,
      projectId: item.value.projectId, newValue: JSON.stringify({ code: line.value.code, category: line.value.category, currency: line.value.currency }),
    });
    return ok({ id });
  }
}

/** An expense against one line. The lead of the activity or a manager may book one. */
export class AddBudgetExpenseHandler {
  constructor(private readonly access: PlanAccess, private readonly budgets: IBudgetLineReader & IBudgetExpenseWriter, private readonly ids: IIdGenerator, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, itemId: string, lineId: string, input: { date: string; amount: string; description?: string }): Promise<Result<{ id: string }, DomainError>> {
    const item = await this.access.load(ctx, itemId, "EDIT_NOTES");
    if (!item.ok) return item;
    const line = await this.budgets.findLineById(lineId, ctx.tenant.tenantId);
    if (!line.ok) return line;
    if (!line.value || line.value.plannedActivityId !== itemId) return err(DomainError.notFound("BudgetLine", lineId));
    const expense = checkExpense(input);
    if (!expense.ok) return expense;
    const id = this.ids.generate();
    const saved = await this.budgets.addExpense({
      id, tenantId: ctx.tenant.tenantId.toString(), projectId: item.value.projectId, budgetLineId: lineId,
      expenseDate: expense.value.date, amountMinor: expense.value.amountMinor, description: expense.value.description,
      createdById: ctx.tenant.userId, createdAt: this.clock.now(),
    });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "workplan.expense_added", entityType: "planned_activity", entityId: itemId,
      projectId: item.value.projectId, newValue: JSON.stringify({ lineId, amountMinor: expense.value.amountMinor }),
    });
    return ok({ id });
  }
}

/** The budget of one planned activity: each line, what has been spent, and where it stands. Anyone who can see the plan. */
export class GetPlanItemBudgetHandler {
  constructor(private readonly access: PlanAccess, private readonly budgets: IBudgetLineReader & IBudgetExpenseReader) {}

  async handle(ctx: AuthenticatedContext, itemId: string): Promise<Result<BudgetLineView[], DomainError>> {
    const item = await this.access.load(ctx, itemId, "VIEW");
    if (!item.ok) return item;
    const lines = await this.budgets.findLinesByItem(itemId, ctx.tenant.tenantId);
    if (!lines.ok) return lines;
    const expenses = await this.budgets.findExpensesByLines(lines.value.map((l) => l.id), ctx.tenant.tenantId);
    if (!expenses.ok) return expenses;
    return ok(lines.value.map((l) => toView(l, expenses.value.filter((e) => e.budgetLineId === l.id))));
  }
}

function toView(line: BudgetLineRecord, expenses: BudgetExpenseRecord[]): BudgetLineView {
  return {
    id: line.id, code: line.code, category: line.category, description: line.description, donorName: line.donorName, currency: line.currency,
    position: budgetPosition(line.amountMinor, expenses.map((e) => ({ date: e.expenseDate, amountMinor: e.amountMinor }))),
    expenses: expenses.map((e) => ({ id: e.id, date: e.expenseDate, amountMinor: e.amountMinor, description: e.description })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** A project's budget against spending, per currency and per activity. For people on the project (or an admin). */
export class GetProjectBudgetHandler {
  constructor(private readonly items: IPlannedActivityRepository, private readonly budgets: IBudgetLineReader & IBudgetExpenseReader, private readonly context: IPlanContextReader) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<ProjectBudgetCurrency[], DomainError>> {
    if (ctx.tenant.role !== "ADMIN") {
      const members = await this.context.activeMemberIds(projectId, ctx.tenant.tenantId);
      if (!members.ok) return members;
      if (!members.value.has(ctx.tenant.userId)) return err(DomainError.forbidden("You are not on this project"));
    }
    const lines = await this.budgets.findLinesByProject(projectId, ctx.tenant.tenantId);
    if (!lines.ok) return lines;
    if (lines.value.length === 0) return ok([]);
    const expenses = await this.budgets.findExpensesByLines(lines.value.map((l) => l.id), ctx.tenant.tenantId);
    if (!expenses.ok) return expenses;
    const items = await this.items.findByProject(projectId, ctx.tenant.tenantId);
    if (!items.ok) return items;
    const titles = new Map(items.value.map((i) => [i.id, i.title]));
    const spent = new Map<string, number>();
    for (const e of expenses.value) spent.set(e.budgetLineId, (spent.get(e.budgetLineId) ?? 0) + e.amountMinor);
    return ok(projectBudgetSummary(lines.value.map((l) => ({
      activityId: l.plannedActivityId, activityTitle: titles.get(l.plannedActivityId) ?? "An activity", currency: l.currency,
      budgetedMinor: l.amountMinor, spentMinor: spent.get(l.id) ?? 0,
    }))));
  }
}
