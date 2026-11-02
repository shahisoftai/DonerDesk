import { budgetLinesForLaunch, ok } from "@donordesk/domain";
import type { ISetupLaunchStep, SetupBudgetWriter, SetupPlanRows } from "../../../ports/project-setup-launch.js";

/**
 * Creates the budget lines the person placed on planned activities, each on its own activity. An activity is found again by its
 * title and start day. A line that cannot be placed, or that the activity already has (same code), is a note, so a repeat never
 * adds one twice. Lines that pay for the whole project have no activity to sit under and are left to the report.
 */
export class BudgetLinesStep implements ISetupLaunchStep {
  readonly key = "BUDGET_LINES";
  constructor(private readonly plan: SetupPlanRows, private readonly budget: SetupBudgetWriter) {}
  async run(...[ctx, projectId, draft]: Parameters<ISetupLaunchStep["run"]>) {
    const { lines } = budgetLinesForLaunch(draft);
    if (lines.length === 0) return ok({ done: 0, notes: [] });
    const rows = await this.plan.rows(ctx, projectId);
    if (!rows.ok) return rows;
    let done = 0;
    const notes: string[] = [];
    const seen = new Map<string, Set<string>>();
    for (const line of lines) {
      const matches = rows.value.filter((r) => r.title === line.title && (line.start === null || r.plannedStart === line.start));
      if (matches.length !== 1) { notes.push(`${line.description || line.code}: ${matches.length === 0 ? `the activity “${line.title}” was not found` : `more than one activity is called “${line.title}”`}, so the line was not added.`); continue; }
      const itemId = matches[0]!.id;
      if (!seen.has(itemId)) {
        const existing = await this.budget.existingCodes(ctx, itemId);
        if (!existing.ok) return existing;
        seen.set(itemId, existing.value);
      }
      const codes = seen.get(itemId)!;
      let code = line.code;
      for (let n = 2; codes.has(code); n += 1) code = `${line.code.slice(0, 26)}-${n}`;
      const added = await this.budget.add(ctx, itemId, { code, category: line.category, description: line.description, currency: line.currency, amount: line.amount });
      if (added.ok) { done += 1; codes.add(code); } else notes.push(`${line.description || line.code}: ${added.error.message}`);
    }
    return ok({ done, notes });
  }
}
