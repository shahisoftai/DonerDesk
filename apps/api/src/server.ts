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
import { registerTemplateRoutes } from "./routes/templates.js";
import { registerLogframeRoutes } from "./routes/logframe.js";
import { registerEvidenceRoutes } from "./routes/evidence.js";
import { registerActivityRoutes } from "./routes/activities.js";
import { registerReportingRoutes } from "./routes/reporting.js";
import { registerComplianceRoutes } from "./routes/compliance.js";
import { registerExportRoutes } from "./routes/exports.js";
import { registerCommentRoutes } from "./routes/comments.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerFileRoutes } from "./routes/files.js";
import { registerHealthRoutes } from "./routes/health.js";
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
  await registerCollaborationWebSocket(app);

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
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "FORBIDDEN"
          ? 403
          : error.code === "CONFLICT"
          ? 409
          : 400;
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
    await registerTemplateRoutes(instance);
    await registerLogframeRoutes(instance);
    await registerEvidenceRoutes(instance);
    await registerActivityRoutes(instance);
    await registerReportingRoutes(instance);
    await registerComplianceRoutes(instance);
    await registerExportRoutes(instance);
    await registerCommentRoutes(instance);
    await registerNotificationRoutes(instance);
    await registerAuditRoutes(instance);
    await registerDashboardRoutes(instance);
    await registerFileRoutes(instance);
  });

  return app;
}

export type AppContext = {
  container: ReturnType<typeof createContainer>;
};

declare module "fastify" {
  interface FastifyInstance {
    container: ReturnType<typeof createContainer>;
  }
}

export async function start() {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
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
