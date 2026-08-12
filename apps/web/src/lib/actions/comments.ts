"use server";

import { CreateCommentSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import { CommentsResponseSchema } from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema, OkResponseSchema } from "./_schemas";

export type ListCommentsResult = Result<Array<unknown>, AppError>;

export async function listCommentsAction(
  entityType: string,
  entityId: string,
): Promise<ListCommentsResult> {
  const context = await requireSession();
  const result = await gatewayRequest(
    `/v1/comments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
    CommentsResponseSchema,
    context.token,
  );
  if (!result.ok) return result;
  return { ok: true, value: result.value.items };
}

export type AddCommentResult = Result<{ id: string }, AppError>;

export async function addCommentAction(input: {
  entityType: "report_section" | "evidence" | "indicator_update" | "checklist_item" | "activity_update";
  entityId: string;
  commentText: string;
  mentionedUserId?: string;
}): Promise<AddCommentResult> {
  const context = await requireSession();
  const parsed = CreateCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/comments", IdResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type ResolveCommentResult = Result<undefined, AppError>;

export async function resolveCommentAction(id: string): Promise<ResolveCommentResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/comments/${id}/resolve`, OkResponseSchema, context.token, {
    method: "POST",
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
