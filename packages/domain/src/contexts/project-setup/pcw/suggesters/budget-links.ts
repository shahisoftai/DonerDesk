/**
 * Where each budget line belongs (Phase 38.8): the planned activity it pays for, or a support cost. Offered only for lines not
 * yet placed, each with its reason, and never what was rejected. The activity comes from the line's own result link in the
 * document, else from words it shares with exactly one planned activity; a line whose words are those of overheads (staff,
 * administration, audit...) is offered as a support cost. A line that matches nothing gets nothing: no guess.
 * The words that mark a support cost are a table, so a new one is a row.
 */
import { contentWords, wordOverlap, LINK_THRESHOLD } from "../../setup-links.js";
import { budgetKeyOf, planKeyOf, SUPPORT_LINE, type SetupDraft } from "../draft.js";
import { budgetTotalRows } from "../finance-summary.js";
import { live } from "../requirements/shared.js";

export interface BudgetSuggestion {
  /** `BUDGET:budgetKey:target`; what a rejection remembers and an acceptance names. */
  id: string;
  budgetKey: string;
  /** A planned activity's key, or `SUPPORT`. */
  target: string;
  reason: string;
}

/** Words that mark a cost of running the project as a whole. */
export const SUPPORT_WORDS: readonly string[] = ["staff", "salary", "salaries", "personnel", "administration", "administrative", "overhead", "overheads", "audit", "evaluation", "monitoring", "office", "indirect", "running", "management", "insurance", "visibility"];

export function suggestBudgetLinks(draft: SetupDraft): BudgetSuggestion[] {
  const rejected = new Set(draft.extras.rejectedSuggestions);
  const plans = live(draft.proposal.plan).map((def) => ({ def, key: planKeyOf(def), words: contentWords(`${def.title ?? ""}`) }));
  return budgetTotalRows(draft).flatMap((line) => {
    const key = budgetKeyOf(line);
    if (draft.extras.finance.budgetPlan[key] !== undefined) return [];
    const make = (target: string, reason: string): BudgetSuggestion[] => {
      const id = `BUDGET:${key}:${target}`;
      return rejected.has(id) ? [] : [{ id, budgetKey: key, target, reason }];
    };
    const byResult = line.logframeCode ? plans.filter((p) => p.def.logframeCode === line.logframeCode) : [];
    if (byResult.length === 1) return make(byResult[0]!.key, `Your budget ties this line to activity ${line.logframeCode}, and “${byResult[0]!.def.title}” is the work planned for it.`);
    const words = contentWords(line.category ?? "");
    if ([...words].some((w) => SUPPORT_WORDS.includes(w))) return make(SUPPORT_LINE, "Costs like this usually run the whole project rather than one activity.");
    const scored = plans.map((p) => ({ p, score: wordOverlap(words, p.words) })).filter((x) => x.score >= LINK_THRESHOLD).sort((a, b) => b.score - a.score);
    if (scored.length === 0 || (scored.length > 1 && scored[0]!.score === scored[1]!.score)) return [];
    return make(scored[0]!.p.key, `Its name shares words with “${scored[0]!.p.def.title}”.`);
  });
}
