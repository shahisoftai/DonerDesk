/**
 * Edits to funding and budget lines (Phase 38.8): the pure operations the finance slide makes on the proposal. A line a person
 * adds or changes is theirs (EDITED, no quote). An amount is read by the one locale-aware reader and stored as plain digits;
 * an amount that could mean two things ("1,250") is refused with the way to write it, never guessed. A currency is three
 * letters. A budget line gets a stable `key` the first time it is edited, so the activity chosen for it survives a new
 * category or amount. One operation is one row in `FINANCE_OPERATIONS`.
 */
import { normaliseAmountText } from "../apply-sheets.js";
import type { BudgetLineDef, FundingDef, ProjectSetupProposal, Proposed } from "../proposal.js";
import { budgetKeyOf } from "./draft.js";

export type FinanceOperation =
  | { kind: "ADD_FUNDING"; sourceName: string; amount: string; currency: string }
  | { kind: "EDIT_FUNDING"; path: string; patch: Partial<Pick<FundingDef, "sourceName" | "amount" | "currency">> }
  | { kind: "ADD_BUDGET"; category: string; amount: string; currency: string; ref?: string | null; budgetKind?: "LINE" | "DETAIL" }
  | { kind: "EDIT_BUDGET"; path: string; patch: Partial<Pick<BudgetLineDef, "category" | "amount" | "currency" | "ref" | "kind">> };

export type FinanceOperationResult = { ok: true; proposal: ProjectSetupProposal } | { ok: false; reason: string };
type Handler<K extends FinanceOperation["kind"]> = (p: ProjectSetupProposal, op: Extract<FinanceOperation, { kind: K }>) => FinanceOperationResult;

const refuse = (reason: string): FinanceOperationResult => ({ ok: false, reason });
const clean = (v: string | null | undefined, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** A readable, positive amount as plain digits, or the sentence that says how to write it. */
function amount(raw: string | null | undefined): { ok: true; value: string } | { ok: false; reason: string } {
  const text = clean(raw, 40);
  if (!text) return { ok: false, reason: "Enter an amount." };
  const plain = normaliseAmountText(text);
  if (plain === null) return { ok: false, reason: `“${text}” could be read in more than one way. Write it with no thousands separator, for example 1250 or 1250.50.` };
  return Number(plain) > 0 ? { ok: true, value: plain } : { ok: false, reason: "An amount has to be more than zero." };
}

function currency(raw: string | null | undefined): { ok: true; value: string } | { ok: false; reason: string } {
  const c = clean(raw, 10)?.toUpperCase() ?? "";
  return /^[A-Z]{3}$/.test(c) ? { ok: true, value: c } : { ok: false, reason: "A currency is three letters, for example USD." };
}

const person = <T>(value: T): Proposed<T> => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });
const editable = <T>(items: ReadonlyArray<Proposed<T>>, path: string, field: string): { index: number; item: Proposed<T> } | null => {
  const [head, raw] = path.split(".");
  const index = Number(raw);
  const item = head === field && Number.isInteger(index) ? items[index] : undefined;
  return item && item.status !== "REJECTED" && item.value !== null ? { index, item } : null;
};

function freshBudgetKey(p: ProjectSetupProposal): string {
  const used = new Set(p.budget.filter((x) => x.value !== null).map((x) => budgetKeyOf(x.value!)));
  for (let n = p.budget.length + 1; ; n += 1) if (!used.has(`new-budget:${n}`)) return `new-budget:${n}`;
}

export const FINANCE_OPERATIONS: { [K in FinanceOperation["kind"]]: Handler<K> } = {
  ADD_FUNDING: (p, op) => {
    const source = clean(op.sourceName, 200);
    if (!source) return refuse("Say who the funding comes from.");
    const a = amount(op.amount), c = currency(op.currency);
    if (!a.ok) return refuse(a.reason);
    if (!c.ok) return refuse(c.reason);
    const same = p.funding.some((f) => f.status !== "REJECTED" && f.value !== null && f.value.sourceName?.trim().toLowerCase() === source.toLowerCase() && f.value.currency === c.value && Number(f.value.amount) === Number(a.value));
    if (same) return refuse("That funding is already on the list.");
    return { ok: true, proposal: { ...p, funding: [...p.funding, person<FundingDef>({ sourceName: source, amount: a.value, currency: c.value })] } };
  },
  EDIT_FUNDING: (p, { path, patch }) => {
    const at = editable(p.funding, path, "funding");
    if (!at) return refuse("That funding is not in the project.");
    const next: FundingDef = { ...at.item.value! };
    if (patch.sourceName !== undefined) { const s = clean(patch.sourceName, 200); if (!s) return refuse("Say who the funding comes from."); next.sourceName = s; }
    if (patch.amount !== undefined) { const a = amount(patch.amount); if (!a.ok) return refuse(a.reason); next.amount = a.value; }
    if (patch.currency !== undefined) { const c = currency(patch.currency); if (!c.ok) return refuse(c.reason); next.currency = c.value; }
    return { ok: true, proposal: { ...p, funding: p.funding.map((f, i) => (i === at.index ? { ...f, value: next, status: "EDITED" as const } : f)) } };
  },
  ADD_BUDGET: (p, op) => {
    const category = clean(op.category, 200);
    if (!category) return refuse("Give the budget line a name.");
    const a = amount(op.amount), c = currency(op.currency);
    if (!a.ok) return refuse(a.reason);
    if (!c.ok) return refuse(c.reason);
    const value: BudgetLineDef = { category, amount: a.value, currency: c.value, logframeCode: null, kind: op.budgetKind ?? "LINE", ref: clean(op.ref, 40), key: freshBudgetKey(p) };
    return { ok: true, proposal: { ...p, budget: [...p.budget, person(value)] } };
  },
  EDIT_BUDGET: (p, { path, patch }) => {
    const at = editable(p.budget, path, "budget");
    if (!at) return refuse("That budget line is not in the project.");
    const next: BudgetLineDef = { ...at.item.value!, key: budgetKeyOf(at.item.value!) };
    if (patch.category !== undefined) { const s = clean(patch.category, 200); if (!s) return refuse("Give the budget line a name."); next.category = s; }
    if (patch.amount !== undefined) { const a = amount(patch.amount); if (!a.ok) return refuse(a.reason); next.amount = a.value; }
    if (patch.currency !== undefined) { const c = currency(patch.currency); if (!c.ok) return refuse(c.reason); next.currency = c.value; }
    if (patch.ref !== undefined) next.ref = clean(patch.ref, 40);
    if (patch.kind !== undefined) next.kind = patch.kind;
    return { ok: true, proposal: { ...p, budget: p.budget.map((b, i) => (i === at.index ? { ...b, value: next, status: "EDITED" as const } : b)) } };
  },
};

export function applyFinanceOperation(proposal: ProjectSetupProposal, op: FinanceOperation): FinanceOperationResult {
  const handler = FINANCE_OPERATIONS[op.kind] as (p: ProjectSetupProposal, o: FinanceOperation) => FinanceOperationResult;
  return handler(proposal, op);
}
