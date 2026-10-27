import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { API_SCOPES, WEBHOOK_EVENTS } from "@donordesk/domain";

const CreateKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(API_SCOPES)).min(1),
  projectIds: z.array(z.string().min(1)).max(100).default([]),
  expiresInDays: z.number().int().min(1).max(730).optional(),
});
const CreateWebhookSchema = z.object({ url: z.string().min(1).max(500), events: z.array(z.enum(WEBHOOK_EVENTS)).min(1) });
const UpdateWebhookSchema = z.object({ events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(), enabled: z.boolean().optional() });

/** API keys and webhooks (Phase 33.7), managed by an administrator. Thin: validate, call one handler, throw its error. */
export async function registerIntegrationRoutes(app: FastifyInstance) {
  const ctx = (req: { tenant: unknown; id: string }) => ({ tenant: req.tenant as never, requestId: req.id });
  const param = (req: { params: unknown }, name: string) => (req.params as Record<string, string>)[name]!;
  const h = (req: { container: { handlers: unknown } }) => req.container.handlers as import("@donordesk/infrastructure").Container["handlers"];

  app.get("/v1/integrations/api-keys", async (req) => {
    const r = await h(req as never).listApiKeys.handle(ctx(req));
    if (!r.ok) throw r.error;
    return { keys: r.value };
  });
  // The token is in this response and nowhere else.
  app.post("/v1/integrations/api-keys", async (req, reply) => {
    const r = await h(req as never).createApiKey.handle(ctx(req), CreateKeySchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });
  app.post("/v1/integrations/api-keys/:keyId/revoke", async (req) => {
    const r = await h(req as never).revokeApiKey.handle(ctx(req), param(req, "keyId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.get("/v1/integrations/webhooks", async (req) => {
    const r = await h(req as never).listWebhooks.handle(ctx(req));
    if (!r.ok) throw r.error;
    return { webhooks: r.value };
  });
  // The signing secret is in this response and nowhere else.
  app.post("/v1/integrations/webhooks", async (req, reply) => {
    const r = await h(req as never).createWebhook.handle(ctx(req), CreateWebhookSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });
  app.put("/v1/integrations/webhooks/:webhookId", async (req) => {
    const r = await h(req as never).updateWebhook.handle(ctx(req), param(req, "webhookId"), UpdateWebhookSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return { ok: true };
  });
  app.delete("/v1/integrations/webhooks/:webhookId", async (req) => {
    const r = await h(req as never).deleteWebhook.handle(ctx(req), param(req, "webhookId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });
  app.get("/v1/integrations/webhooks/:webhookId/deliveries", async (req) => {
    const r = await h(req as never).listWebhookDeliveries.handle(ctx(req), param(req, "webhookId"));
    if (!r.ok) throw r.error;
    return { deliveries: r.value };
  });
}
