"use server";

import { z } from "zod";
import { SetAutomationRuleSettingsSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

const ValuesSchema = z.record(z.string(), z.number());

/** The numbers for one rule. The server checks each against the rule's own range and says which one is wrong. */
export async function setAutomationRuleSettingsAction(projectId: string, ruleKey: string, values: Record<string, number>): Promise<Result<Record<string, number>, AppError>> {
  const context = await requireSession();
  const parsed = SetAutomationRuleSettingsSchema.safeParse({ values });
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) } };
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/automations/${encodeURIComponent(ruleKey)}/settings`, ValuesSchema, context.token, { method: "PUT", body: parsed.data });
}
