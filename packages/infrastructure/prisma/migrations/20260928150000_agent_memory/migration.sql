-- Agent Memory (Phase 21) — learned tenant/donor style guidance (additive).
-- Never stores facts, figures, dates, or claims: entity-level and
-- extraction-time guards keep this table on the "narration" side of the
-- assurance boundary. RLS is added in a separate step (infra/postgres/rls.sql)
-- so the migrator can apply both in the same deploy.

ALTER TABLE "Organization" ADD COLUMN "agentMemoryEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT,
    "category" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provenanceJson" TEXT NOT NULL DEFAULT '[]',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentMemory_tenantId_idx" ON "AgentMemory"("tenantId");
CREATE INDEX "AgentMemory_tenantId_scope_scopeId_status_idx" ON "AgentMemory"("tenantId", "scope", "scopeId", "status");

-- Reminder: re-run infra/postgres/rls.sql after this migration so
-- "AgentMemory" gets its tenant_isolation policy and donordesk_app grants.
