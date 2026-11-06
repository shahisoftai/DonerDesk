"use server";

import {
  AccountForAdvanceSchema, AddAdvanceSchema, AddCurrencyRateSchema, AddDeliverableSchema, AddDisbursementSchema, AddProjectFundingSchema, AddRegisterExpenseSchema, CreateBudgetCategorySchema,
  CreateFundingSourceSchema, DecideEntrySchema, SetSeparateApproverSchema, UpdateDraftDisbursementSchema, UpdateDraftExpenseSchema, ImportRegisterSheetSchema, PayDeliverableSchema, SetFinanceCurrenciesSchema, UpdateFundingSourceSchema,
} from "@donordesk/contracts";
import { z, type ZodTypeAny } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { RegisterImportSchema, type RegisterImport } from "@/lib/server/schemas-finance";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

/** The finance register's writes (Phase 35.F). Each one validates its input, sends it to the API (which applies the permission and the rules) and says what happened. */
const invalid = (error: Parameters<typeof flattenZodFields>[0]) => ({
  ok: false as const,
  error: { kind: "validation" as const, message: "Please correct the highlighted fields.", fields: flattenZodFields(error) },
});
const enc = encodeURIComponent;

const Response = z.object({ id: z.string().optional(), ok: z.boolean().optional() }).passthrough();
type Done = Result<{ id?: string }, AppError>;

async function send(path: string, method: "POST" | "PUT" | "DELETE", input: unknown, schema: ZodTypeAny | null): Promise<Done> {
  const context = await requireSession();
  let payload: unknown = {};
  if (schema) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    payload = parsed.data;
  }
  const r = await gatewayRequest(path, Response, context.token, { method, body: payload });
  return r.ok ? { ok: true, value: typeof r.value.id === "string" ? { id: r.value.id } : {} } : r;
}

const p = (projectId: string) => `/v1/projects/${enc(projectId)}/finance`;

export async function addFundingSourceAction(input: unknown): Promise<Done> { return send("/v1/finance/funding-sources", "POST", input, CreateFundingSourceSchema); }
export async function updateFundingSourceAction(id: string, input: unknown): Promise<Done> { return send(`/v1/finance/funding-sources/${enc(id)}`, "PUT", input, UpdateFundingSourceSchema); }
export async function addBudgetCategoryAction(input: unknown): Promise<Done> { return send("/v1/finance/budget-categories", "POST", input, CreateBudgetCategorySchema); }
export async function addCurrencyRateAction(input: unknown): Promise<Done> { return send("/v1/finance/rates", "POST", input, AddCurrencyRateSchema); }
export async function setFinanceCurrenciesAction(input: unknown): Promise<Done> { return send("/v1/finance/currencies", "PUT", input, SetFinanceCurrenciesSchema); }

export async function addProjectFundingAction(projectId: string, input: unknown): Promise<Done> { return send(`${p(projectId)}/funding`, "POST", input, AddProjectFundingSchema); }
export async function removeProjectFundingAction(projectId: string, fundingId: string): Promise<Done> { return send(`${p(projectId)}/funding/${enc(fundingId)}`, "DELETE", {}, null); }
export async function addDisbursementAction(projectId: string, input: unknown): Promise<Done> { return send(`${p(projectId)}/disbursements`, "POST", input, AddDisbursementSchema); }
export async function addExpenseAction(projectId: string, lineId: string, input: unknown): Promise<Done> { return send(`${p(projectId)}/budget-lines/${enc(lineId)}/expenses`, "POST", input, AddRegisterExpenseSchema); }
export async function decideEntryAction(projectId: string, kind: "EXPENSE" | "DISBURSEMENT", id: string, input: unknown): Promise<Done> {
  return send(`${p(projectId)}/${kind === "EXPENSE" ? "expenses" : "disbursements"}/${enc(id)}/decision`, "POST", input, DecideEntrySchema);
}
export async function updateDraftEntryAction(projectId: string, kind: "EXPENSE" | "DISBURSEMENT", id: string, input: unknown): Promise<Done> {
  return send(`${p(projectId)}/${kind === "EXPENSE" ? "expenses" : "disbursements"}/${enc(id)}`, "PUT", input, kind === "EXPENSE" ? UpdateDraftExpenseSchema : UpdateDraftDisbursementSchema);
}
export async function setSeparateApproverAction(input: unknown): Promise<Done> { return send("/v1/finance/approval", "PUT", input, SetSeparateApproverSchema); }
export async function addDeliverableAction(projectId: string, input: unknown): Promise<Done> { return send(`${p(projectId)}/deliverables`, "POST", input, AddDeliverableSchema); }
export async function approveDeliverableAction(projectId: string, id: string): Promise<Done> { return send(`${p(projectId)}/deliverables/${enc(id)}/approve`, "POST", {}, null); }
export async function payDeliverableAction(projectId: string, id: string, input: unknown): Promise<Done> { return send(`${p(projectId)}/deliverables/${enc(id)}/pay`, "POST", input, PayDeliverableSchema); }
export async function addAdvanceAction(projectId: string, input: unknown): Promise<Done> { return send(`${p(projectId)}/advances`, "POST", input, AddAdvanceSchema); }
export async function accountForAdvanceAction(projectId: string, id: string, input: unknown): Promise<Done> { return send(`${p(projectId)}/advances/${enc(id)}/accounting`, "POST", input, AccountForAdvanceSchema); }

/** `apply: false` only checks: nothing is stored until the person confirms, and one bad row blocks every row. */
export async function importRegisterSheetAction(projectId: string, input: unknown): Promise<Result<RegisterImport, AppError>> {
  const context = await requireSession();
  const parsed = ImportRegisterSheetSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`${p(projectId)}/import`, RegisterImportSchema, context.token, { method: "POST", body: parsed.data });
}
