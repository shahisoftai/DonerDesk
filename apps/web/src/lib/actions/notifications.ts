"use server";

import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";

export async function markNotificationReadAction(id: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/notifications/${id}/read`, OkResponseSchema, context.token, {
    method: "POST",
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
