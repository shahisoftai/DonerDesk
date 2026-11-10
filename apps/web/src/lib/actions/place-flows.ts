"use server";

import { AddPlaceFlowSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import { PlaceFlowSchema, type PlaceFlowView } from "@/lib/server/schemas-place-flows";

/** Record that something moved from one place to another. The rules (two live, different places; a quantity above zero) are the server's. */
export async function addPlaceFlowAction(projectId: string, input: unknown): Promise<Result<PlaceFlowView, AppError>> {
  const parsed = AddPlaceFlowSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "This movement could not be understood.", fields: flattenZodFields(parsed.error), retryable: false } as AppError };
  const context = await requireSession();
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/place-flows`, PlaceFlowSchema, context.token, { method: "POST", body: parsed.data });
}

export async function removePlaceFlowAction(projectId: string, flowId: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/place-flows/${encodeURIComponent(flowId)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return result.ok ? { ok: true, value: undefined } : result;
}
