"use server";

import { AskQuestionSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { AskOutcomeSchema, type AskOutcomeView } from "@/lib/server/schemas-ask";

/** One question to one project's records. The answer comes back checked: every sentence names its sources. */
export async function askProjectAction(projectId: string, input: unknown): Promise<Result<AskOutcomeView, AppError>> {
  const context = await requireSession();
  const parsed = AskQuestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "Write a question of at least three characters.", fields: flattenZodFields(parsed.error) } };
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/ask`, AskOutcomeSchema, context.token, { method: "POST", body: parsed.data, timeoutMs: 60_000 });
}
