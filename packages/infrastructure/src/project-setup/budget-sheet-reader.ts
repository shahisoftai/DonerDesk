/**
 * The budget workbook shortcut (Phase 36 optimisation): a "Summary Budget" sheet is a table of categories and totals, so its
 * lines are read exactly, with the sheet's own line as the quote. Only top-level categories become budget lines (the
 * indented rows under them are their parts), subtotals and totals are never lines, and an empty category is left out. The
 * currency is taken only when the sheet names it; otherwise it stays Not stated.
 */
import { FIELD_LIMITS, fit } from "./fit-text.js";
import type { BudgetLineDef, Proposed, SourceBlock } from "@donordesk/domain";
import { joinBrokenRows } from "./sheet-rows.js";

export interface PartialSheetRead {
  fields: Record<string, unknown>;
  /** Documents this read fully accounts for: the model is not shown them again. */
  documentIds: ReadonlyArray<string>;
  /** REPLACE (default): the sheet's fields replace the model's. APPEND: list fields are joined, the sheet's items first. */
  combine?: "REPLACE" | "APPEND";
}

export type PartialSheetReader = (blocks: ReadonlyArray<SourceBlock>) => PartialSheetRead | null;

const CURRENCY_NAMES: ReadonlyArray<readonly [RegExp, string]> = [
  [/pakistani rupee|\bpkrs?\b/i, "PKR"], [/us dollar|u\.s\. dollar|\busd\b/i, "USD"], [/\beuros?\b|\beur\b/i, "EUR"],
  [/pound sterling|british pound|\bgbp\b/i, "GBP"], [/kenyan shilling|\bkes\b/i, "KES"], [/ugandan shilling|\bugx\b/i, "UGX"],
];

const SUMMARY_TITLE = /^#\s*summary budget\s*$/i;
const NUMBER = /^-?\d[\d,]*(\.\d+)?$/;
const QUOTE_LIMIT = 400;

const currencyOf = (lines: ReadonlyArray<string>): string | null => {
  const sentence = lines.find((l) => /budgets? (is |are )?(developed|prepared|expressed|presented|in)\b/i.test(l)) ?? "";
  return CURRENCY_NAMES.find(([pattern]) => pattern.test(sentence))?.[1] ?? null;
};

// The amount exactly as the sheet shows it (thousands separators dropped), so it is found in its own quote.
const amountText = (n: string): string => n.replace(/,/g, "");

/** The lines of a document's Summary Budget sheet, or null when it has none. */
function summaryLines(text: string): string[] | null {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => SUMMARY_TITLE.test(l.trim()));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.startsWith("# "));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

export const readBudgetSheet: PartialSheetReader = (blocks) => {
  const byDocument = new Map<string, SourceBlock[]>();
  for (const block of blocks) byDocument.set(block.documentId, [...(byDocument.get(block.documentId) ?? []), block]);
  const consumed: string[] = [];
  let budget: Proposed<BudgetLineDef>[] | null = null;
  for (const [documentId, document] of byDocument) {
    const lines = summaryLines(document.map((b) => b.text).join("\n"));
    if (!lines) continue;
    consumed.push(documentId);
    if (budget) continue; // a second workbook with the same sheet is the same budget, read once
    const currency = currencyOf(lines);
    const found: Proposed<BudgetLineDef>[] = [];
    for (const line of lines) {
      const cells = line.split("\t");
      // Top level = the label sits at the left of its cell (a space or two at most); the parts under a category are indented deeper.
      const labelCell = cells.find((c) => c.trim() !== "");
      if (!labelCell || (/^ */.exec(labelCell)?.[0].length ?? 0) > 2) continue;
      const label = labelCell.trim();
      const amount = [...cells].reverse().map((c) => c.trim()).find((c) => NUMBER.test(c));
      // The grand total is kept, as a TOTAL, to check the categories against; sub-totals are neither lines nor totals.
      const grandTotal = /^total project costs?$/i.test(label) && !found.some((f) => f.value!.kind === "TOTAL");
      if (!grandTotal && (/^(sub)?total\b/i.test(label) || /\b(total|subtotal)\b/i.test(label) && /\bcosts?\b/i.test(label))) continue;
      if (amount === undefined || Number(amount.replace(/,/g, "")) === 0) continue;
      const block = document.find((b) => b.text.includes(line.trim()));
      if (!block) continue;
      found.push({
        value: { category: fit(label, FIELD_LIMITS.category), amount: amountText(amount), currency, logframeCode: null, kind: grandTotal ? "TOTAL" : "LINE" },
        sourceQuote: line.trim().replace(/\s+/g, " ").slice(0, QUOTE_LIMIT),
        sourceRef: { documentId: block.documentId, block: block.index, ...(block.page !== undefined ? { page: block.page } : {}) },
        confidence: "HIGH",
        status: "PROPOSED",
      });
    }
    budget = [...found, ...detailRows(document, currency)];
  }
  return consumed.length > 0 && budget && budget.length > 0 ? { fields: { budget }, documentIds: consumed } : null;
};

const DETAIL_TITLE = /^#\s*detailed budget\s*$/i;
const DETAIL_REF = /^[A-Z]{1,2}\s?\.?\s?\d+(?:\s?\.\s?\d+)*$/;
const DETAIL_GRAND_TOTAL = /^total estimated costs?$/i;

/**
 * The rows of a "Detailed Budget" sheet (Phase 37.2): every referenced row with a cost in the sheet's own Cost column, as a
 * DETAIL (headings and rows of 0 are left out), and the sheet's grand total as a TOTAL, so `checkBudgetTotals` can say
 * whether the rows add up. A row with no description of its own is named by its reference.
 */
function detailRows(document: ReadonlyArray<SourceBlock>, currency: string | null): Proposed<BudgetLineDef>[] {
  const lines = document.map((b) => b.text).join("\n").split(/\r?\n/);
  const start = lines.findIndex((l) => DETAIL_TITLE.test(l.trim()));
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && l.startsWith("# "));
  const sheet = lines.slice(start + 1, end < 0 ? undefined : end);
  const header = sheet.findIndex((l) => l.split("\t").some((c) => c.trim().toLowerCase() === "cost"));
  if (header < 0) return [];
  const costAt = sheet[header]!.split("\t").findIndex((c) => c.trim().toLowerCase() === "cost");
  const out: Proposed<BudgetLineDef>[] = [];
  for (const line of joinBrokenRows(sheet.slice(header + 1), (first) => DETAIL_REF.test(first))) {
    const cells = line.split("\t");
    const ref = (cells[0] ?? "").trim();
    const amount = (cells[costAt] ?? "").trim();
    const label = (cells[1] ?? "").trim();
    const isTotal = !ref && DETAIL_GRAND_TOTAL.test(label);
    if (!isTotal && !DETAIL_REF.test(ref)) continue;
    if (!NUMBER.test(amount) || Number(amount.replace(/,/g, "")) === 0) continue;
    const block = document.find((b) => b.text.replace(/\s+/g, " ").includes(line.trim().replace(/\s+/g, " ")));
    if (!block) continue;
    const description = label || (cells[2] ?? "").trim() || ref;
    out.push({
      value: { category: fit(description, FIELD_LIMITS.category), amount: amountText(amount), currency, logframeCode: null, kind: isTotal ? "TOTAL" : "DETAIL", ref: isTotal ? null : fit(ref, FIELD_LIMITS.code) },
      sourceQuote: line.trim().replace(/\s+/g, " ").slice(0, 1000),
      sourceRef: { documentId: block.documentId, block: block.index, ...(block.page !== undefined ? { page: block.page } : {}) },
      confidence: "HIGH",
      status: "PROPOSED",
    });
  }
  return out;
}
