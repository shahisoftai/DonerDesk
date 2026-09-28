import type { FastifyInstance } from "fastify";
import { ApproveAgentMemorySchema } from "@donordesk/contracts";
import type { AgentMemory } from "@donordesk/domain";

function toResponse(m: AgentMemory) {
  return {
    id: m.id,
    scope: m.scope,
    scopeId: m.scopeId,
    category: m.category,
    statement: m.statement,
    confidence: m.confidence,
    status: m.status,
    occurrenceCount: m.occurrenceCount,
    provenance: m.provenance.map((p) => ({
      sourceRevisionId: p.sourceRevisionId,
      parentRevisionId: p.parentRevisionId,
      sectionId: p.sectionId,
      occurrenceCount: p.occurrenceCount,
      lastObservedAt: p.lastObservedAt.toISOString(),
    })),
    approvedById: m.approvedById,
    approvedAt: m.approvedAt ? m.approvedAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

/**
 * Agent Memory (Phase 21) governance routes — thin, Zod-validated, capability
 * enforcement lives entirely inside the application-layer handlers (same
 * convention `report-claims` routes use, see `reporting.ts`). Kept in its
 * own file rather than folded into the already-large `reporting.ts`.
 */
export async function registerAgentMemoryRoutes(app: FastifyInstance) {
  app.get("/v1/agent-memory", async (req) => {
    const status = ((req.query as { status?: string })?.status ?? "PROPOSED") === "ACTIVE" ? "ACTIVE" : "PROPOSED";
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listPendingAgentMemory.handle(ctx, status);
    if (!r.ok) throw r.error;
    return r.value.map(toResponse);
  });

  app.post("/v1/agent-memory/:id/approve", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = ApproveAgentMemorySchema.parse(req.body ?? {});
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.approveAgentMemory.handle(ctx, id, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/agent-memory/:id/reject", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.rejectAgentMemory.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/agent-memory/:id/deactivate", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.deactivateAgentMemory.handle(ctx, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}
