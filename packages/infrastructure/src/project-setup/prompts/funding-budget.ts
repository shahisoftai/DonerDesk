import { text } from "../proposed-item.js";
import { parseLists, valueKey } from "../list-area.js";
import { mergeLists } from "../extractor-shared.js";
import { factValue } from "./prior.js";
import type { AreaExtractionSpec } from "../area-spec.js";
import { splitAmountCurrency, type BudgetLineDef, type FundingDef } from "@donordesk/domain";

const currency = (x: unknown): string | null => {
  const t = text(x)?.toUpperCase() ?? null;
  return t && /^[A-Z]{3}$/.test(t) ? t : null;
};

const readFunding = (raw: Record<string, unknown>): FundingDef | null => {
  const sourceName = text(raw.sourceName);
  const amount = text(raw.amount);
  return sourceName || amount ? { sourceName, amount, currency: currency(raw.currency) ?? splitAmountCurrency(amount).currency } : null;
};

const readBudget = (raw: Record<string, unknown>): BudgetLineDef | null => {
  const category = text(raw.category);
  const amount = text(raw.amount);
  return category ? { category, amount, currency: currency(raw.currency) ?? splitAmountCurrency(amount).currency, logframeCode: text(raw.logframeCode) } : null;
};

export const FUNDING_BUDGET_SPEC: AreaExtractionSpec = {
  area: "FUNDING_BUDGET",
  promptVersion: "setup-funding-budget-v4",
  sectionTitles: ["budget", "cost", "costs", "financial", "funding", "cost share", "pricing", "payment", "fixed amount", "financement", "budget narrative", "presupuesto", "financiacion", "coste"],
  readsFrom: ["BUDGET", "PROPOSAL"],
  budgetChars: 20_000,
  keywords: ["budget", "funding", "grant", "contribution", "co-financ", "cost", "usd", "eur", "gbp", "total", "personnel", "equipment", "travel"],
  instructions: [
    "Extract who funds the project and the budget lines. Answer:",
    '{"funding": [{"sourceName": "...", "amount": "...", "currency": "USD", "quote": "...", "block": N, "confidence": "..."}],',
    ' "budget": [{"category": "...", "amount": "...", "currency": "USD", "logframeCode": null, "quote": "...", "block": N, "confidence": "..."}]}',
    "amount exactly as written (\"1,250,000\", \"1.250.000,00\"); the currency only when the document names it for that amount.",
    "sourceName is the organisation that provides the money (a donor, a government, or the implementer's own cost share). Never use a programme, project, round or document title as a source name. Give an amount only when the document states one for that source; otherwise null.",
    "Budget lines are the document's own categories or lines. Do not add subtotals or totals the document does not list as a line.",
    "Budget lines come only from the budget table itself. Every costed line of it counts, including a programme support cost or overhead line (PSC) stated with its amount. Never list rows of a summary by sector or location, budget value references or markers (protection, gender, cash), or percentages of the budget: they repeat money already in the lines.",
    "List one funding source once, under its fullest name, with its amount; do not add a second item for another name of the same fund.",
  ].join("\n"),
  context: (prior) => `Project currency already read: ${factValue(prior.facts, "currency") ?? "not stated"}. Use it only where the document applies it to the amount.`,
  parse: parseLists({ funding: readFunding, budget: readBudget }),
  merge: mergeLists(valueKey("sourceName", "category", "amount"), "funding", "budget"),
};
