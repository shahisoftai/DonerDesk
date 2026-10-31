-- The AI project setup wizard (Phase 36): the proposal is stored data a person reviews; the model never writes
-- project records directly. Additive; the source document lives in the encrypting storage, not in the database.
ALTER TABLE "Organization" ADD COLUMN "setupAssistEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ProjectSetupProposal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceStorageKey" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceLength" INTEGER NOT NULL,
    "proposalJson" TEXT NOT NULL DEFAULT '{}',
    "problemsJson" TEXT NOT NULL DEFAULT '[]',
    "appliedProjectId" TEXT,
    "promptVersion" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSetupProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectSetupProposal_tenantId_createdById_idx" ON "ProjectSetupProposal"("tenantId", "createdById");
CREATE INDEX "ProjectSetupProposal_tenantId_status_idx" ON "ProjectSetupProposal"("tenantId", "status");

CREATE TABLE "ProjectSetupRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "area" TEXT,
    "status" TEXT NOT NULL,
    "detailJson" TEXT NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectSetupRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectSetupRun_tenantId_proposalId_idx" ON "ProjectSetupRun"("tenantId", "proposalId");
