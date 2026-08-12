"use server";

import { CreateIndicatorSchema, CreateIndicatorUpdateSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema, OkResponseSchema } from "./_schemas";

export type CreateIndicatorResult = Result<{ id: string }, AppError>;

export async function createIndicatorAction(input: unknown): Promise<CreateIndicatorResult> {
  const context = await requireSession();
  const parsed = CreateIndicatorSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: "validation",
        message: "Please correct the highlighted fields.",
        fields: flattenZodFields(parsed.error),
      },
    };
  }
  return gatewayRequest("/v1/indicators", IdResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export async function createIndicatorUpdateAction(input: unknown): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = CreateIndicatorUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: "validation",
        message: "Please correct the highlighted fields.",
        fields: flattenZodFields(parsed.error),
      },
    };
  }
  return gatewayRequest("/v1/indicator-updates", IdResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export async function verifyIndicatorUpdateAction(id: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/indicator-updates/${id}/verify`, OkResponseSchema, context.token, {
    method: "POST",
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
