import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { createContainer } from "@donordesk/infrastructure";
import { ZodError } from "zod";
import { TenantId, DomainError, type Role } from "@donordesk/domain";

import { authMiddleware } from "./middleware/auth.js";
import { authorizationMiddleware } from "./middleware/authorization.js";
import { dataResidencyMiddleware } from "./middleware/data-residency.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerOrgRoutes } from "./routes/org.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerProjectSetupRoutes } from "./routes/project-setup.js";
import { registerTemplateRoutes } from "./routes/templates.js";
import { registerLogframeRoutes } from "./routes/logframe.js";
import { registerEvidenceRoutes } from "./routes/evidence.js";
import { registerStorageRoutes } from "./routes/storage.js";
import { registerActivityRoutes } from "./routes/activities.js";
import { registerReportingRoutes } from "./routes/reporting.js";
import { registerComplianceRoutes } from "./routes/compliance.js";
import { registerExportRoutes } from "./routes/exports.js";
import { registerCommentRoutes } from "./routes/comments.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerLegalRoutes } from "./routes/legal.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerFileRoutes } from "./routes/files.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerInternalRoutes } from "./routes/internal.js";
import { registerSuperAdminRoutes } from "./routes/superadmin.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { captureException, httpDuration, httpRequests, initializeObservability, shutdownObservability } from "./observability.js";
import { registerCollaborationWebSocket } from "./websocket/register.js";

declare module "fastify" {
  interface FastifyRequest {
    tenant: { tenantId: TenantId; userId: string; role: Role; email: string; name: string };
    requestId: string;
    container: ReturnType<typeof createContainer>;
  }
}

export async function buildServer(): Promise<FastifyInstance> {
  initializeObservability();
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
    genReqId: () => randomUUID(),
  });

  const container = createContainer({ useAdminConnection: true });
  app.decorate("container", container);

  const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  await app.register(cors, { origin: allowedOrigins, credentials: true });
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } });

  // Preserve the raw JSON body so the internal HMAC signature can bind to it.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    const raw = typeof body === "string" ? body : "";
    (_req as FastifyRequest & { rawBody?: string }).rawBody = raw;
    if (raw.trim() === "") {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(raw));
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      e.statusCode = 400;
      done(e, undefined);
    }
  });

  await registerCollaborationWebSocket(app);
  await registerInternalRoutes(app);
  await registerSuperAdminRoutes(app);
  await registerWebhookRoutes(app);

  app.addHook("onRequest", async (req) => {
    req.requestId = req.id;
    (req as FastifyRequest & { startedAt?: bigint }).startedAt = process.hrtime.bigint();
  });

  app.addHook("onResponse", async (req, reply) => {
    const route = req.routeOptions.url ?? "unmatched";
    const startedAt = (req as FastifyRequest & { startedAt?: bigint }).startedAt;
    httpRequests.inc({ route, method: req.method, status: String(reply.statusCode) });
    if (startedAt) httpDuration.observe({ route, method: req.method }, Number(process.hrtime.bigint() - startedAt) / 1e9);
  });

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        type: "https://donordesk/problems/validation",
        title: "Validation failed",
        status: 400,
        errors: error.errors,
        requestId: req.id,
      });
    }
    if (error instanceof DomainError) {
      const status = errorToHttpStatus(error.code);
      return reply.status(status).send({
        type: `https://donordesk/problems/${error.code.toLowerCase()}`,
        title: error.message,
        status,
        code: error.code,
        details: error.details,
        requestId: req.id,
      });
    }
    req.log.error({ err: error }, "unhandled");
    captureException(error);
    return reply.status(500).send({
      type: "https://donordesk/problems/internal",
      title: "Internal Server Error",
      status: 500,
      requestId: req.id,
    });
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await app.register(async (instance) => {
    instance.addHook("preHandler", authMiddleware);
    instance.addHook("preHandler", async (req) => {
      req.container = createContainer({ tenantId: req.tenant.tenantId.toString() });
    });
    instance.addHook("preHandler", authorizationMiddleware);
    instance.addHook("preHandler", dataResidencyMiddleware);
    instance.addHook("onResponse", async (req) => {
      await req.container?.prisma.$disconnect();
    });
    await registerOrgRoutes(instance);
    await registerUserRoutes(instance);
    await registerProjectRoutes(instance);
    await registerProjectSetupRoutes(instance);
    await registerTemplateRoutes(instance);
    await registerLogframeRoutes(instance);
    await registerEvidenceRoutes(instance);
    await registerStorageRoutes(instance);
    await registerActivityRoutes(instance);
    await registerReportingRoutes(instance);
    await registerComplianceRoutes(instance);
    await registerExportRoutes(instance);
    await registerCommentRoutes(instance);
    await registerNotificationRoutes(instance);
    await registerAuditRoutes(instance);
    await registerLegalRoutes(instance);
    await registerDashboardRoutes(instance);
    await registerFileRoutes(instance);
    await registerBillingRoutes(instance);
  });

  return app;
}

export type AppContext = {
  container: ReturnType<typeof createContainer>;
};

/**
 * Maps DomainError codes to HTTP statuses. Project/seat/storage capacity → 409,
 * replenishing AI credits → 429, feature entitlements → 403, provider
 * unavailability → 503. We deliberately do not use HTTP 402.
 */
function errorToHttpStatus(code: string): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
    case "POLICY_DENIED":
      return 403;
    case "CONFLICT":
    case "PLAN_LIMIT_REACHED":
      return 409;
    case "AI_CREDITS_EXHAUSTED":
      return 429;
    case "BILLING_PROVIDER_UNAVAILABLE":
      return 503;
    default:
      return 400;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    container: ReturnType<typeof createContainer>;
  }
}

export async function start() {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 4000);
  // Bind loopback by default (contabo-ops §4/§10); override with HOST if needed.
  await app.listen({ port, host: process.env.HOST ?? "127.0.0.1" });
  const shutdown = async () => {
    await app.close();
    await shutdownObservability();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  app.log.info(`DonorDesk API listening on :${port}`);
  return app;
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  start().catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
}
