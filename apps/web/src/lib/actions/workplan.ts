"use server";

import { ImportWorkPlanSchema, AssignPlannedActivitySchema, ChangePlanStatusSchema, CreatePlannedActivitySchema, ReschedulePlannedActivitySchema, StartPlanFromLogframeSchema } from "@donordesk/contracts";
import type { ZodType } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { idempotency, type CreateOptions } from "./_idempotency";
import { z } from "zod";
import { OkResponseSchema } from "./_schemas";
import { CreatedPlannedActivitiesSchema, ImportWorkPlanResponseSchema, PlanPreviewSchema, type ImportWorkPlanResponse, type PlanPreviewResponse } from "@/lib/server/schemas";

const MovedResponseSchema = z.object({ moved: z.number() });

function invalid<T>(error: import("zod").ZodError): Result<T, AppError> {
  return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(error) } };
}

async function parsed<T>(schema: ZodType<T>, input: unknown): Promise<{ ok: true; data: T } | { ok: false; result: Result<never, AppError> }> {
  const r = schema.safeParse(input);
  return r.success ? { ok: true, data: r.data } : { ok: false, result: invalid(r.error) };
}

export async function createPlannedActivityAction(projectId: string, input: unknown, options: CreateOptions = {}): Promise<Result<{ ids: string[]; capped: boolean }, AppError>> {
  const context = await requireSession();
  const p = await parsed(CreatePlannedActivitySchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/projects/${projectId}/work-plan`, CreatedPlannedActivitiesSchema, context.token, { method: "POST", body: p.data, ...idempotency(options) });
}

export async function changePlanStatusAction(itemId: string, input: unknown): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const p = await parsed(ChangePlanStatusSchema, input);
  if (!p.ok) return p.result;
  const r = await gatewayRequest(`/v1/work-plan/${itemId}/status`, OkResponseSchema, context.token, { method: "POST", body: p.data });
  return r.ok ? { ok: true, value: true } : r;
}

export async function reschedulePlannedActivityAction(itemId: string, input: unknown): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const p = await parsed(ReschedulePlannedActivitySchema, input);
  if (!p.ok) return p.result;
  const r = await gatewayRequest(`/v1/work-plan/${itemId}/reschedule`, MovedResponseSchema, context.token, { method: "POST", body: p.data });
  return r.ok ? { ok: true, value: true } : r;
}

export async function assignPlannedActivityAction(itemId: string, input: unknown): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const p = await parsed(AssignPlannedActivitySchema, input);
  if (!p.ok) return p.result;
  const r = await gatewayRequest(`/v1/work-plan/${itemId}/assign`, OkResponseSchema, context.token, { method: "POST", body: p.data });
  return r.ok ? { ok: true, value: true } : r;
}

/** `apply: false` previews (nothing saved); `apply: true` creates the plan. */
export async function startPlanFromLogframeAction(projectId: string, input: unknown, options: CreateOptions = {}): Promise<Result<PlanPreviewResponse, AppError>> {
  const context = await requireSession();
  const p = await parsed(StartPlanFromLogframeSchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/projects/${projectId}/work-plan/from-logframe`, PlanPreviewSchema, context.token, { method: "POST", body: p.data, ...(p.data.apply ? idempotency(options) : {}) });
}

export async function setWorkPlanningVisibilityAction(projectId: string, show: boolean): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/projects/${projectId}/work-planning`, OkResponseSchema, context.token, { method: "PUT", body: { show } });
  return r.ok ? { ok: true, value: true } : r;
}

/** Imports a work plan from text. Any row that cannot be read stops the whole import; the message names the rows. */
export async function importWorkPlanAction(projectId: string, input: unknown): Promise<Result<ImportWorkPlanResponse, AppError>> {
  const context = await requireSession();
  const p = await parsed(ImportWorkPlanSchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/projects/${projectId}/work-plan/import`, ImportWorkPlanResponseSchema, context.token, { method: "POST", body: p.data });
}
