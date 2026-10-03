import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { metrics } from "../observability.js";

// Fields the deployed Prisma client must know about. Adding a new schema
// column that the application layer uses in a select/create requires adding
// it here too — otherwise /ready will fail and the deploy will be blocked.
const REQUIRED_PRISMA_FIELDS = [
  { model: "Organization", field: "storageProvider" },
  { model: "ReportingPeriod", field: "donorTemplateId" },
  { model: "ReportingPeriod", field: "storyContextJson" },
  { model: "ReportingPeriod", field: "scopeJson" },
  { model: "ReportDraft", field: "supersededAt" },
  { model: "User", field: "passwordChangedAt" },
  { model: "PasswordResetToken", field: "tokenHash" },
  { model: "DonorTemplateMapping", field: "detectedRegionsJson" },
  { model: "DonorTemplateMapping", field: "templatedFileUrl" },
  { model: "LogframeItem", field: "sortOrder" },
  { model: "IndicatorUpdate", field: "disaggregationJson" },
  { model: "DonorTemplate", field: "requirementsJson" },
  { model: "DonorTemplate", field: "status" },
  { model: "DonorTemplate", field: "extractionMetaJson" },
  { model: "DonorTemplate", field: "originalFileName" },
  { model: "DonorTemplate", field: "isLibrary" },
  { model: "DonorTemplate", field: "sourceTemplateId" },
  { model: "DonorTemplateVersion", field: "sectionsJson" },
  { model: "ReportSection", field: "level" },
  { model: "ReportSection", field: "numbering" },
  { model: "ReportSection", field: "templateSectionId" },
  { model: "Organization", field: "agentMemoryEnabled" },
  { model: "AgentMemory", field: "provenanceJson" },
  { model: "Project", field: "archivedAt" },
  { model: "Project", field: "isDemo" },
  { model: "PurchasedCreditPack", field: "providerOrderId" },
  { model: "PurchasedCreditPack", field: "source" },
  { model: "Organization", field: "nonprofitVerifiedAt" },
  { model: "NonprofitVerification", field: "status" },
] as const;

type RuntimeDataModel = {
  models: Record<string, { fields: Array<{ name: string }> }>;
};

function introspectPrisma(prisma: unknown): { ok: boolean; missing: string[] } {
  const rdm = (prisma as { _runtimeDataModel?: RuntimeDataModel })._runtimeDataModel;
  if (!rdm || typeof rdm.models !== "object") {
    return { ok: false, missing: REQUIRED_PRISMA_FIELDS.map((r) => `${r.model}.${r.field}`) };
  }
  const missing: string[] = [];
  for (const { model, field } of REQUIRED_PRISMA_FIELDS) {
    const m = rdm.models[model];
    if (!m || !Array.isArray(m.fields) || !m.fields.some((f) => f.name === field)) {
      missing.push(`${model}.${field}`);
    }
  }
  return { ok: missing.length === 0, missing };
}

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (_req, reply) => {
    const checks: Record<string, string> = {};
    try {
      await app.container.prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      return reply.status(503).send({ status: "not_ready", checks: { database: "failed" } });
    }
    const introspection = introspectPrisma(app.container.prisma);
    if (!introspection.ok) {
      checks.prismaClient = "stale";
      return reply.status(503).send({
        status: "not_ready",
        checks,
        missingPrismaFields: introspection.missing,
        hint: "Run `prisma generate` against packages/infrastructure/prisma/schema.prisma and restart the api.",
      });
    }
    checks.prismaClient = "ok";
    return { status: "ready", checks };
  });
  app.get("/metrics", async (_req, reply) => {
    reply.type("text/plain; version=0.0.4");
    return metrics.metrics();
  });
  app.get("/v1/ping", { preHandler: authMiddleware }, async (req, reply) => {
    const tenantId = req.tenant.tenantId.toString();
    reply.header("x-tenant-id", tenantId);
    return { pong: true, service: "donordesk-api", tenantId, ts: new Date().toISOString() };
  });
}
