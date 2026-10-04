import { z } from "zod";

const Amount = z.string().trim().min(1).max(40);

export const FinanceLineSchema = z.object({
  budgetLine: z.string().trim().min(1).max(120),
  budget: Amount,
  expenditure: Amount,
  committed: z.string().trim().max(40).optional(),
});

/** Figures typed in, or the lines of a confirmed import. With lines the totals are their sums. */
export const SavePeriodFinanceSchema = z.object({
  currency: z.string().trim().length(3).optional(),
  sourceNote: z.string().trim().max(300).optional(),
  lines: z.array(FinanceLineSchema).max(200).optional(),
  budget: z.string().trim().max(40).optional(),
  expenditure: z.string().trim().max(40).optional(),
  committed: z.string().trim().max(40).optional(),
});
export type SavePeriodFinanceInput = z.infer<typeof SavePeriodFinanceSchema>;

/** Pasted spreadsheet rows, already split into cells. */
export const PreviewFinanceImportSchema = z.object({
  rows: z.array(z.array(z.string().max(500)).max(20)).max(500),
});
export type PreviewFinanceImportInput = z.infer<typeof PreviewFinanceImportSchema>;
