"use server";

import { SetupFinanceOperationSchema, SetupOperationSchema, SetupPlaceOperationSchema, SetupPlanOperationSchema, SetupResultOperationSchema, SetupRiskOperationSchema, StartBlankSetupSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import {
  LaunchReportSchema, SetupDraftStartedSchema, SetupDraftViewSchema, SetupPackAppliedSchema,
  type LaunchReport, type SetupDraftView, type SetupPackApplied,
} from "@/lib/server/schemas-project-setup-draft";

const invalid = (error: Parameters<typeof flattenZodFields>[0]) => ({
  ok: false as const,
  error: { kind: "validation" as const, message: "Please correct the highlighted fields.", fields: flattenZodFields(error) },
});

/** Begins the Project Creation Wizard with no documents; a start from documents uses `startSetupAction`. */
export async function startDraftAction(input: unknown): Promise<Result<{ proposalId: string }, AppError>> {
  const context = await requireSession();
  const parsed = StartBlankSetupSchema.safeParse(input ?? {});
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest("/v1/project-setup/drafts", SetupDraftStartedSchema, context.token, { method: "POST", body: parsed.data });
}

export async function getDraftAction(id: string): Promise<Result<SetupDraftView, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/project-setup/drafts/${encodeURIComponent(id)}`, SetupDraftViewSchema, context.token);
}

/** One slide edit. The server re-checks it and answers with the whole re-derived view. */
export async function editDraftAction(id: string, operation: unknown): Promise<Result<SetupDraftView, AppError>> {
  const context = await requireSession();
  const parsed = SetupOperationSchema.safeParse(operation);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/project-setup/drafts/${encodeURIComponent(id)}/operations`, SetupDraftViewSchema, context.token, { method: "POST", body: parsed.data });
}

/** Fills the empty answers from the sector's starting answers; nothing already answered is changed. */
export async function applyPackAction(id: string): Promise<Result<SetupPackApplied, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/project-setup/drafts/${encodeURIComponent(id)}/pack`, SetupPackAppliedSchema, context.token, { method: "POST", body: {} });
}

/** One edit to the results framework or an indicator; it changes the proposal itself, so the server checks the version. */
export async function changeResultsAction(id: string, operation: unknown): Promise<Result<SetupDraftView, AppError>> {
  const context = await requireSession();
  const parsed = SetupResultOperationSchema.safeParse(operation);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/project-setup/drafts/${encodeURIComponent(id)}/results`, SetupDraftViewSchema, context.token, { method: "POST", body: parsed.data });
}

/** One edit to the places list; it changes the proposal itself, so the server checks the version. */
export async function changePlacesAction(id: string, operation: unknown): Promise<Result<SetupDraftView, AppError>> {
  const context = await requireSession();
  const parsed = SetupPlaceOperationSchema.safeParse(operation);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/project-setup/drafts/${encodeURIComponent(id)}/places`, SetupDraftViewSchema, context.token, { method: "POST", body: parsed.data });
}

/** One edit to the planned activities; it changes the proposal itself, so the server checks the version. */
export async function changePlanAction(id: string, operation: unknown): Promise<Result<SetupDraftView, AppError>> {
  const context = await requireSession();
  const parsed = SetupPlanOperationSchema.safeParse(operation);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/project-setup/drafts/${encodeURIComponent(id)}/plan`, SetupDraftViewSchema, context.token, { method: "POST", body: parsed.data });
}

/** One edit to the funding or the budget lines; it changes the proposal itself, so the server checks the version. */
export async function changeFinanceAction(id: string, operation: unknown): Promise<Result<SetupDraftView, AppError>> {
  const context = await requireSession();
  const parsed = SetupFinanceOperationSchema.safeParse(operation);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/project-setup/drafts/${encodeURIComponent(id)}/finance`, SetupDraftViewSchema, context.token, { method: "POST", body: parsed.data });
}

/** One edit to the risks and assumptions list; it changes the proposal itself, so the server checks the version. */
export async function changeRisksAction(id: string, operation: unknown): Promise<Result<SetupDraftView, AppError>> {
  const context = await requireSession();
  const parsed = SetupRiskOperationSchema.safeParse(operation);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/project-setup/drafts/${encodeURIComponent(id)}/risks`, SetupDraftViewSchema, context.token, { method: "POST", body: parsed.data });
}

/** Signs off what is on the page. The server records who and when; nothing is sent about it. */
export async function signOffAction(id: string): Promise<Result<SetupDraftView, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/project-setup/drafts/${encodeURIComponent(id)}/sign-off`, SetupDraftViewSchema, context.token, { method: "POST", body: {} });
}

/** Starts the project. The server re-checks everything; if it stops partway, the same call carries on where it left off. */
export async function launchProjectAction(id: string): Promise<Result<LaunchReport, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/project-setup/drafts/${encodeURIComponent(id)}/launch`, LaunchReportSchema, context.token, { method: "POST", body: {}, timeoutMs: 180_000 });
}
