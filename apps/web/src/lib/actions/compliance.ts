"use server";

import { ResolveChecklistItemSchema, BulkResolveChecklistSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema, BulkResolveResponseSchema } from "./_schemas";

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

export type BulkResolveChecklistResult = Result<{ resolved: number; skipped: number }, AppError>;

export async function bulkResolveChecklistAction(
  periodId: string,
  itemIds: string[],
  decision: "RESOLVE" | "ACCEPT_RISK" | "NOT_APPLICABLE" | "START",
  notes?: string,
): Promise<BulkResolveChecklistResult> {
  const context = await requireSession();
  const parsed = BulkResolveChecklistSchema.safeParse({ itemIds, decision, notes });
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest(`/v1/reporting-periods/${periodId}/checklist/bulk-resolve`, BulkResolveResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}
