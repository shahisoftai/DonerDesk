import { z } from "zod";

/** Request bodies of the finance register (Phase 35.F). Amounts and days arrive as text and are checked by the domain (`contexts/finance/entry-checks`); these only bound shape and length. */
const text = (max: number) => z.string().max(max);
const amount = z.string().min(1).max(30);
const currency = z.string().min(3).max(3);
const day = z.string().min(10).max(10);

export const CreateFundingSourceSchema = z.object({ name: text(120), ownFunding: z.boolean().optional() });
export const UpdateFundingSourceSchema = z.object({ ownFunding: z.boolean().optional(), archived: z.boolean().optional() }).refine((v) => v.ownFunding !== undefined || v.archived !== undefined, { message: "Nothing to change." });
export const CreateBudgetCategorySchema = z.object({ code: text(30), label: text(120) });
export const AddCurrencyRateSchema = z.object({ from: currency, to: currency, rate: text(20), effectiveOn: day, source: text(160).optional() });
export const SetFinanceCurrenciesSchema = z.object({ primaryCurrency: currency, localCurrency: currency.optional().or(z.literal("")) });

export const AddProjectFundingSchema = z.object({ fundingSourceId: z.string().min(1).max(64), date: day, amount, currency, note: text(300).optional() });
export const AddDisbursementSchema = z.object({ fundingSourceId: z.string().min(1).max(64), date: day, amount, currency, memo: text(300).optional() });
export const AddRegisterExpenseSchema = z.object({ date: day, amount, currency: currency.optional(), vendor: text(160), memo: text(300).optional(), fundingSourceId: z.string().max(64).optional(), evidenceId: z.string().max(64).optional() });
export const DecideEntrySchema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), note: text(300).optional() });
export const AddDeliverableSchema = z.object({ name: text(120), amount, currency, dueOn: day });
export const PayDeliverableSchema = z.object({ on: day });
export const AddAdvanceSchema = z.object({ heldBy: text(160), givenOn: day, amount, currency, note: text(300).optional() });
export const AccountForAdvanceSchema = z.object({ date: day, amount, currency, note: text(300).optional() });
export const ImportRegisterSheetSchema = z.object({ text: z.string().max(2_000_000), apply: z.boolean() });
