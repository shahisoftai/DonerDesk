import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { metrics } from "../observability.js";

// Fields the deployed Prisma client must know about. Adding a new schema
// column that the application layer uses in a select/create requires adding
// it here too — otherwise /ready will fail and the deploy will be blocked.
const REQUIRED_PRISMA_FIELDS = [
  { model: "Organization", field: "storageProvider" },
  { model: "Indicator", field: "archivedAt" },
  { model: "ActivityUpdate", field: "supersededById" },
  { model: "ActivityUpdate", field: "activityEndDate" },
  { model: "ReportingPeriod", field: "donorTemplateId" },
  { model: "ReportingPeriod", field: "storyContextJson" },
  { model: "ReportingPeriod", field: "scopeJson" },
  { model: "ReportingPeriod", field: "cancelledAt" },
  { model: "ReportingPeriod", field: "cancelReason" },
  { model: "RequestIdempotency", field: "responseJson" },
  { model: "ReportSection", field: "summaryCurrentAt" },
  { model: "ReportingProfile", field: "defaultTemplateByTypeJson" },
  { model: "ReportingProfile", field: "requireSecondApprover" },
  { model: "ReportingProfile", field: "standingStatementsJson" },
  { model: "ChecklistItem", field: "attestedById" },
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
  { model: "ReportSection", field: "generationFallbackReason" },
  { model: "ReportSection", field: "generationFallbackDetail" },
  { model: "Organization", field: "agentMemoryEnabled" },
  { model: "AgentMemory", field: "provenanceJson" },
  { model: "Project", field: "archivedAt" },
  { model: "Project", field: "isDemo" },
  { model: "EvidenceFile", field: "indicatorUpdateId" },
  { model: "ActivityUpdate", field: "logframeActivityId" },
  { model: "PurchasedCreditPack", field: "providerOrderId" },
  { model: "PurchasedCreditPack", field: "source" },
  { model: "Organization", field: "nonprofitVerifiedAt" },
  { model: "NonprofitVerification", field: "status" },
  { model: "ReportingProfile", field: "financeDataMode" },
  { model: "PeriodFinancialSummary", field: "verificationStatus" },
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
    // The AI writer is a warning, never a reason to stop serving: reports fall back to a labelled basic version without it.
    if (process.env.AI_REPORTER_ENABLED === "1") checks.aiWorker = await aiWorkerStatus();
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

/** "ok" when the AI worker answers its health check within a few seconds, otherwise "unavailable" (non-blocking). */
async function aiWorkerStatus(): Promise<"ok" | "unavailable"> {
  const base = (process.env.AI_REPORTER_URL ?? "http://127.0.0.1:8092").replace(/\/+$/, "");
  try {
    const token = process.env.INTERNAL_TOKEN;
    const response = await fetch(`${base}/v1/ai-reporter/health`, { signal: AbortSignal.timeout(3000), ...(token ? { headers: { "X-Internal-Token": token } } : {}) });
    return response.ok ? "ok" : "unavailable";
  } catch {
    return "unavailable";
  }
}
