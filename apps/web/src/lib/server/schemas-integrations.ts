import { z } from "zod";

export const ApiKeySchema = z.object({
  id: z.string(), name: z.string(), prefix: z.string(), scopes: z.array(z.string()), projectIds: z.array(z.string()),
  expiresAt: z.string().optional(), revokedAt: z.string().optional(), lastUsedAt: z.string().optional(), createdAt: z.string(),
  status: z.enum(["ACTIVE", "REVOKED", "EXPIRED"]),
});
export type ApiKeyItem = z.infer<typeof ApiKeySchema>;
export const ApiKeyListSchema = z.object({ keys: z.array(ApiKeySchema) });
export const ApiKeyCreatedSchema = z.object({ key: ApiKeySchema, token: z.string() });

export const WebhookSchema = z.object({
  id: z.string(), url: z.string(), events: z.array(z.string()), enabled: z.boolean(), disabledReason: z.string().optional(),
  consecutiveFailures: z.number().int(), createdAt: z.string(),
});
export type WebhookItem = z.infer<typeof WebhookSchema>;
export const WebhookListSchema = z.object({ webhooks: z.array(WebhookSchema) });
export const WebhookCreatedSchema = z.object({ endpoint: WebhookSchema, secret: z.string() });
export const WebhookDeliveriesSchema = z.object({
  deliveries: z.array(z.object({ id: z.string(), event: z.string(), status: z.string(), attempts: z.number().int(), statusCode: z.number().int().optional(), error: z.string().optional(), createdAt: z.string() })),
});
export type WebhookDeliveryItem = z.infer<typeof WebhookDeliveriesSchema>["deliveries"][number];
