"use server";

import { CreateLogframeItemSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema } from "./_schemas";

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
