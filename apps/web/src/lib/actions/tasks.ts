"use server";

import { CompleteTaskSchema, CreateTaskSchema, SetOwnerSchema } from "@donordesk/contracts";
import type { ZodType } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { idempotency, type CreateOptions } from "./_idempotency";
import { IdResponseSchema, OkResponseSchema } from "./_schemas";

async function parsed<T>(schema: ZodType<T>, input: unknown): Promise<{ ok: true; data: T } | { ok: false; result: Result<never, AppError> }> {
  const r = schema.safeParse(input);
  return r.success
    ? { ok: true, data: r.data }
    : { ok: false, result: { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(r.error) } } };
}

/** One person asking another for something. The kind comes from the button pressed. Creates are repeatable by key. */
export async function createTaskAction(projectId: string, input: unknown, options: CreateOptions = {}): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const p = await parsed(CreateTaskSchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/tasks`, IdResponseSchema, context.token, { method: "POST", body: p.data, ...idempotency(options) });
}

async function ok(path: string, method: "POST" | "PUT", body: unknown): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(path, OkResponseSchema, context.token, { method, body });
  return r.ok ? { ok: true, value: true } : r;
}

export async function completeTaskAction(taskId: string, input: unknown = {}): Promise<Result<true, AppError>> {
  const p = await parsed(CompleteTaskSchema, input);
  return p.ok ? ok(`/v1/tasks/${encodeURIComponent(taskId)}/complete`, "POST", p.data) : p.result;
}

export async function cancelTaskAction(taskId: string): Promise<Result<true, AppError>> {
  return ok(`/v1/tasks/${encodeURIComponent(taskId)}/cancel`, "POST", {});
}

/** The three "Lead" pickers. `userId: null` removes the lead. */
export async function setIndicatorOwnerAction(indicatorId: string, input: unknown): Promise<Result<true, AppError>> {
  const p = await parsed(SetOwnerSchema, input);
  return p.ok ? ok(`/v1/indicators/${encodeURIComponent(indicatorId)}/owner`, "PUT", p.data) : p.result;
}

export async function setPeriodOwnerAction(periodId: string, input: unknown): Promise<Result<true, AppError>> {
  const p = await parsed(SetOwnerSchema, input);
  return p.ok ? ok(`/v1/periods/${encodeURIComponent(periodId)}/owner`, "PUT", p.data) : p.result;
}

export async function assignChecklistItemAction(itemId: string, input: unknown): Promise<Result<true, AppError>> {
  const p = await parsed(SetOwnerSchema, input);
  return p.ok ? ok(`/v1/checklist/${encodeURIComponent(itemId)}/assign`, "POST", p.data) : p.result;
}

/** The one reminder setting: how I want to be emailed. */
export async function setEmailSummaryModeAction(emailSummaryMode: string): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest("/v1/me/notification-preferences", OkResponseSchema, context.token, { method: "PUT", body: { emailSummaryMode } });
  return r.ok ? { ok: true, value: true } : r;
}
