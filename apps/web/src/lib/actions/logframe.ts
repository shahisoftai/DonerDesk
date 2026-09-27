"use server";

import { CreateLogframeItemSchema, ImportLogframeTextSchema, MoveLogframeItemSchema, UpdateIndicatorSemanticsSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema, OkResponseSchema } from "./_schemas";
import { ImportLogframeResponseSchema, type ImportLogframeResponse } from "@/lib/server/schemas";

export type CreateLogframeItemResult = Result<{ id: string }, AppError>;

export async function createLogframeItemAction(input: unknown): Promise<CreateLogframeItemResult> {
  const context = await requireSession();
  const parsed = CreateLogframeItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/logframe-items", IdResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export async function moveLogframeItemAction(itemId: string, input: unknown): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const parsed = MoveLogframeItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { kind: "validation", message: "Invalid move.", fields: flattenZodFields(parsed.error) } };
  }
  const result = await gatewayRequest(`/v1/logframe-items/${encodeURIComponent(itemId)}/position`, OkResponseSchema, context.token, {
    method: "PUT",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type ImportLogframeTextResult = Result<ImportLogframeResponse, AppError>;

/** Auto-parses logframe content (Level/Code/Title/Description) and creates records. */
export async function importLogframeTextAction(input: unknown): Promise<ImportLogframeTextResult> {
  const context = await requireSession();
  const parsed = ImportLogframeTextSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/logframe/import", ImportLogframeResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type UpdateIndicatorSemanticsResult = Result<{ id: string }, AppError>;

/** Declares how an indicator is aggregated (e.g. directly reported rate vs numerator ÷ denominator). */
export async function updateIndicatorSemanticsAction(input: unknown): Promise<UpdateIndicatorSemanticsResult> {
  const context = await requireSession();
  const parsed = UpdateIndicatorSemanticsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest(`/v1/indicators/${parsed.data.indicatorId}/semantics`, IdResponseSchema, context.token, {
    method: "PUT",
    body: parsed.data,
  });
}
