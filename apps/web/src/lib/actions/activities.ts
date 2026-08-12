"use server";

import { CreateActivityUpdateSchema, ReviewActivitySchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema, OkResponseSchema, PolishActivityResponseSchema } from "./_schemas";

export type CreateActivityResult = Result<{ id: string }, AppError>;

export async function createActivityAction(input: unknown): Promise<CreateActivityResult> {
  const context = await requireSession();
  const parsed = CreateActivityUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/activities", IdResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type PolishActivityResult = Result<{ narrative: string; model: string }, AppError>;

export async function polishActivityAction(activityId: string): Promise<PolishActivityResult> {
  const context = await requireSession();
  return gatewayRequest("/v1/activities/polish", PolishActivityResponseSchema, context.token, {
    method: "POST",
    body: { activityId },
  });
}

export type ReviewActivityResult = Result<undefined, AppError>;

export async function reviewActivityAction(input: {
  activityId: string;
  decision: "ACCEPT" | "REVISE" | "REJECT";
  notes?: string;
}): Promise<ReviewActivityResult> {
  const context = await requireSession();
  const parsed = ReviewActivitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest("/v1/activities/review", OkResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
