import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { createContainer } from "@donordesk/infrastructure";

const MAX_WEBHOOK_BYTES = 256 * 1024;

/**
 * Public provider webhook endpoint. Registered OUTSIDE the tenant-auth plugin.
 *
 * - Captures exact raw bytes (bound to the application/json parser above).
 * - Verifies the provider HMAC signature against the raw body.
 * - Inserts a durable inbox row keyed by the globally unique provider event id
 *   (duplicates return 200 with no effects), then processes the event.
 * - Responds 200 promptly after durable receipt so the provider stops retrying.
 */
export async function registerWebhookRoutes(app: FastifyInstance) {
  await app.register(async (instance) => {
    const container = createContainer({ useAdminConnection: true });

    instance.post("/v1/webhooks/creem", async (req, reply) => {
      const rawBody = getRawBody(req);
      if (!rawBody || rawBody.length === 0) {
        return reply.status(400).send({ type: "https://donordesk/problems/validation", title: "Empty webhook body", status: 400 });
      }
      if (rawBody.length > MAX_WEBHOOK_BYTES) {
        return reply.status(413).send({ type: "https://donordesk/problems/payload_too_large", title: "Webhook body too large", status: 413 });
      }
      const signature = String(req.headers["creem-signature"] ?? "");
      const result = await container.handlers.processBillingWebhook.handle({
        provider: "CREEM",
        rawBody,
        signature,
      });
      if (!result.ok) {
        const error = result.error;
        const status = error.code === "FORBIDDEN" ? 401 : error.code === "VALIDATION_FAILED" ? 400 : 400;
        return reply.status(status).send({
          type: `https://donordesk/problems/${error.code.toLowerCase()}`,
          title: error.message,
          status,
          code: error.code,
          requestId: req.id,
        });
      }
      return { ok: true, handled: result.value.handled };
    });

    instance.addHook("onResponse", async () => {
      await container.prisma.$disconnect();
    });
  });
}

function getRawBody(req: FastifyRequest): Buffer | undefined {
  const raw = (req as FastifyRequest & { rawBody?: unknown }).rawBody;
  if (typeof raw === "string") return Buffer.from(raw, "utf8");
  if (raw instanceof Buffer) return raw;
  if (typeof raw === "object" && raw !== null) {
    // Parser parsed JSON; re-serialize deterministically for verification.
    return Buffer.from(JSON.stringify(raw), "utf8");
  }
  return undefined;
}

export const WebhookRouteSchema = z.object({});
