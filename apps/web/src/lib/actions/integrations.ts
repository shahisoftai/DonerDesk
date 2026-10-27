"use server";

import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import { ApiKeyCreatedSchema, WebhookCreatedSchema, WebhookDeliveriesSchema } from "@/lib/server/schemas-integrations";

const KeyInput = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.string()).min(1),
  projectIds: z.array(z.string()).default([]),
  expiresInDays: z.number().int().min(1).max(730).optional(),
});
const HookInput = z.object({ url: z.string().trim().min(1).max(500), events: z.array(z.string()).min(1) });

const invalid = (error: z.ZodError) => ({ ok: false as const, error: { kind: "validation" as const, message: "Please correct the highlighted fields.", fields: flattenZodFields(error) } });

export async function createApiKeyAction(input: unknown): Promise<Result<z.infer<typeof ApiKeyCreatedSchema>, AppError>> {
  const context = await requireSession();
  const parsed = KeyInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest("/v1/integrations/api-keys", ApiKeyCreatedSchema, context.token, { method: "POST", body: parsed.data });
}

export async function revokeApiKeyAction(keyId: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/integrations/api-keys/${encodeURIComponent(keyId)}/revoke`, OkResponseSchema, context.token, { method: "POST", body: {} });
  return r.ok ? { ok: true, value: undefined } : r;
}

export async function createWebhookAction(input: unknown): Promise<Result<z.infer<typeof WebhookCreatedSchema>, AppError>> {
  const context = await requireSession();
  const parsed = HookInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest("/v1/integrations/webhooks", WebhookCreatedSchema, context.token, { method: "POST", body: parsed.data });
}

export async function setWebhookEnabledAction(webhookId: string, enabled: boolean): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/integrations/webhooks/${encodeURIComponent(webhookId)}`, OkResponseSchema, context.token, { method: "PUT", body: { enabled } });
  return r.ok ? { ok: true, value: undefined } : r;
}

export async function deleteWebhookAction(webhookId: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/integrations/webhooks/${encodeURIComponent(webhookId)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return r.ok ? { ok: true, value: undefined } : r;
}

export async function listWebhookDeliveriesAction(webhookId: string): Promise<Result<z.infer<typeof WebhookDeliveriesSchema>, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/integrations/webhooks/${encodeURIComponent(webhookId)}/deliveries`, WebhookDeliveriesSchema, context.token);
}
