"use server";

import { ResolveChecklistItemSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";

export type ResolveChecklistItemResult = Result<undefined, AppError>;

export async function resolveChecklistItemAction(
  itemId: string,
  decision: "RESOLVE" | "ACCEPT_RISK" | "NOT_APPLICABLE" | "START",
): Promise<ResolveChecklistItemResult> {
  const context = await requireSession();
  const parsed = ResolveChecklistItemSchema.safeParse({ decision });
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest(`/v1/checklist/${itemId}/resolve`, OkResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
