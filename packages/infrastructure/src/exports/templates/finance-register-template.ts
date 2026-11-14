import { SHEET_COLUMNS } from "@donordesk/domain";
import type { TemplateColumn } from "./template-kit.js";
import { addDataSheet, addGuideSheet, cachedBuild, newWorkbook, toBuffer } from "./template-kit.js";

export const FINANCE_REGISTER_TEMPLATE_FILENAME = "finance-register-template.xlsx";

type FinanceHeader = (typeof SHEET_COLUMNS)[number];
const SPEC: Readonly<Record<FinanceHeader, Omit<TemplateColumn, "header">>> = {
  Type: { width: 16, required: true, takes: "Whether this is money spent or money received", example: "Expense", choices: ["Expense", "Money received"] },
  Date: { width: 14, required: true, takes: "The day, written YYYY-MM-DD", example: "2026-03-14" },
  Amount: { width: 14, required: true, takes: "A number with a dot for decimals and no thousands separator, for example 1250.50", example: "1250.50" },
  Currency: { width: 10, required: false, takes: "Three-letter code (USD, EUR); an expense takes its budget line's currency, money received the organisation's", example: "USD" },
  "Paid to": { width: 24, required: false, takes: "Who was paid (expenses)", example: "Kampala Printers Ltd" },
  "What for": { width: 30, required: false, takes: "A short note", example: "Training handouts" },
  "Budget line": { width: 16, required: false, takes: "Code of the project's budget line; needed for an expense", example: "BL-03" },
  "Funding source": { width: 24, required: false, takes: "Name of the funding source; needed for money received, optional for an expense", example: "" },
};

/** One row per header the finance register import reads (`SHEET_COLUMNS`), so the two cannot drift. */
export const FINANCE_REGISTER_COLUMNS: ReadonlyArray<TemplateColumn> = SHEET_COLUMNS.map((header) => ({ header, ...SPEC[header] }));

export const buildFinanceRegisterTemplate = cachedBuild(async () => {
  const wb = newWorkbook();
  addDataSheet(wb, "Finance register", FINANCE_REGISTER_COLUMNS);
  addGuideSheet(wb, [
    "Fill the first sheet, one entry per row, then upload this file on the project's Finance page > Import.",
    "Check the sheet first. Any row with a problem blocks the whole import, and you can download your sheet back with a Problems column. Imported entries are drafts until someone approves them.",
  ], FINANCE_REGISTER_COLUMNS, [
    { Type: "Expense", Date: "2026-03-14", Amount: "1250.50", Currency: "USD", "Paid to": "Kampala Printers Ltd", "What for": "Training handouts", "Budget line": "BL-03" },
    { Type: "Money received", Date: "2026-03-01", Amount: "50000", Currency: "USD", "What for": "First tranche", "Funding source": "UNICEF" },
  ]);
  return toBuffer(wb);
});
