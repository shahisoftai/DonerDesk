"use server";

import { RecordAdaptationSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema } from "./_schemas";

/** Records a change of plan: what changed, why, and what it did to the results. */
export async function recordAdaptationAction(projectId: string, input: unknown): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = RecordAdaptationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) } };
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/adaptations`, IdResponseSchema, context.token, { method: "POST", body: parsed.data });
}
