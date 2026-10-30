import { z } from "zod";

/** Response shapes of the finance register routes (Phase 35.F). */
const Money = z.object({ minor: z.number(), currency: z.string() });
const PrimaryTotal = z.object({ total: Money.nullable(), needsRate: z.array(z.object({ date: z.string(), amount: Money })) }).passthrough();

export const FundingSourceListSchema = z.object({ sources: z.array(z.object({ id: z.string(), name: z.string(), ownFunding: z.boolean(), archived: z.boolean() })) });
export type FundingSourceItem = z.infer<typeof FundingSourceListSchema>["sources"][number];
export const BudgetCategoryListSchema = z.object({ categories: z.array(z.object({ id: z.string(), code: z.string(), label: z.string(), archived: z.boolean() })) });
export const RatesSchema = z.object({
  separateApprover: z.boolean().default(false),
  primaryCurrency: z.string(), localCurrency: z.string().nullable(),
  rates: z.array(z.object({ id: z.string(), from: z.string(), to: z.string(), rate: z.string(), effectiveOn: z.string(), source: z.string() })),
});
export type RatesView = z.infer<typeof RatesSchema>;

export const ProjectFinanceSchema = z.object({
  primaryCurrency: z.string(),
  funding: z.array(z.object({ id: z.string(), sourceId: z.string(), sourceName: z.string(), ownFunding: z.boolean(), date: z.string(), amount: Money, note: z.string() })),
  index: z.object({ obligated: z.array(Money), disbursed: z.array(Money), remaining: z.array(Money), spent: z.array(Money), otherFunding: z.array(Money) }),
  inPrimary: z.object({ obligated: PrimaryTotal, disbursed: PrimaryTotal, spent: PrimaryTotal }),
  register: z.array(z.object({
    id: z.string(), date: z.string(), kind: z.enum(["EXPENSE", "DISBURSEMENT"]), memo: z.string(), amount: Money, balanceMinor: z.number(), ageDays: z.number(),
    status: z.string(), vendor: z.string().optional(), sourceId: z.string().optional(), hasEvidence: z.boolean().optional(), budgetLineId: z.string().optional(), canDecide: z.boolean(),
    canEdit: z.boolean().default(false), evidenceId: z.string().optional(), enteredByMe: z.boolean().default(false),
  })),
  totals: z.object({ spent: z.array(Money), disbursed: z.array(Money), pending: z.array(Money), rejectedCount: z.number(), outstandingAdvances: z.array(Money), unclassifiedExpenses: z.number(), withoutEvidence: z.number() }),
  advances: z.array(z.object({
    id: z.string(), heldBy: z.string(), givenOn: z.string(), amount: Money, note: z.string(),
    position: z.object({ accountedMinor: z.number(), outstandingMinor: z.number(), overAccounted: z.boolean(), ageDays: z.number().nullable(), overdue: z.boolean() }).passthrough(),
  })),
  deliverables: z.array(z.object({ id: z.string(), name: z.string(), amount: Money, dueOn: z.string(), state: z.string(), approvedAt: z.string().optional(), paidOn: z.string().optional() })),
  budgetLines: z.array(z.object({
    lineId: z.string(), code: z.string(), description: z.string(), category: z.string(), budget: Money, spentMinor: z.number(), remainingMinor: z.number(),
    spentPercent: z.number().nullable(), overspent: z.boolean(), otherCurrencySpent: z.number(),
  })),
  burn: z.object({ spentPercent: z.number().nullable(), timeElapsedPercent: z.number().nullable(), gapPoints: z.number().nullable() }).nullable(),
  sources: z.array(z.object({ id: z.string(), name: z.string(), ownFunding: z.boolean(), archived: z.boolean() })),
  evidence: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  separateApprover: z.boolean().default(false),
});
export type ProjectFinance = z.infer<typeof ProjectFinanceSchema>;

export const RegisterImportSchema = z.object({
  rows: z.number(), valid: z.number(), invalid: z.number(), unknownColumns: z.array(z.string()), missingColumns: z.array(z.string()),
  problems: z.array(z.object({ row: z.number(), message: z.string() })), imported: z.number(), alreadyThere: z.number(), applied: z.boolean(), errorFile: z.string().optional(),
});
export type RegisterImport = z.infer<typeof RegisterImportSchema>;

export const PortfolioFinanceSchema = z.object({
  primaryCurrency: z.string(),
  index: z.object({ obligated: z.array(Money), disbursed: z.array(Money), remaining: z.array(Money), spent: z.array(Money), otherFunding: z.array(Money) }),
  inPrimary: z.object({ obligated: PrimaryTotal, disbursed: PrimaryTotal, spent: PrimaryTotal }),
  projects: z.number(), projectsWithFunding: z.number(), awaitingApproval: z.number(),
});
export type PortfolioFinance = z.infer<typeof PortfolioFinanceSchema>;
