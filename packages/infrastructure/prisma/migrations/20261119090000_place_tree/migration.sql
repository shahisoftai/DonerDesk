-- Phase 56: one place tree. A project's footprint (ProjectArea), place links on completed activities, evidence and people reached,
-- confirmed typed words, merges, and where an indicator is measured. Additive. Re-run infra/postgres/rls.sql afterwards (five new tables; RLS forced).
ALTER TABLE "Place" ADD COLUMN "mergedIntoId" TEXT;
ALTER TABLE "Indicator" ADD COLUMN "placeScope" TEXT NOT NULL DEFAULT 'PROJECT';
ALTER TABLE "Indicator" ADD COLUMN "placeIdsJson" TEXT;
-- Indicators already recorded by place read as measured at a level.
UPDATE "Indicator" SET "placeScope" = 'LEVEL' WHERE "recordByPlace" = true;

CREATE TABLE "ProjectArea" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectArea_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectArea_projectId_placeId_key" ON "ProjectArea"("projectId", "placeId");
CREATE INDEX "ProjectArea_tenantId_placeId_idx" ON "ProjectArea"("tenantId", "placeId");
CREATE INDEX "ProjectArea_tenantId_projectId_idx" ON "ProjectArea"("tenantId", "projectId");

CREATE TABLE "ActivityUpdatePlace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activityUpdateId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CHOSEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityUpdatePlace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActivityUpdatePlace_activityUpdateId_placeId_key" ON "ActivityUpdatePlace"("activityUpdateId", "placeId");
CREATE INDEX "ActivityUpdatePlace_tenantId_projectId_idx" ON "ActivityUpdatePlace"("tenantId", "projectId");
CREATE INDEX "ActivityUpdatePlace_tenantId_placeId_idx" ON "ActivityUpdatePlace"("tenantId", "placeId");

CREATE TABLE "EvidencePlace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "evidenceFileId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CHOSEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidencePlace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EvidencePlace_evidenceFileId_placeId_key" ON "EvidencePlace"("evidenceFileId", "placeId");
CREATE INDEX "EvidencePlace_tenantId_projectId_idx" ON "EvidencePlace"("tenantId", "projectId");
CREATE INDEX "EvidencePlace_tenantId_placeId_idx" ON "EvidencePlace"("tenantId", "placeId");

CREATE TABLE "BeneficiaryPlace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CHOSEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BeneficiaryPlace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BeneficiaryPlace_beneficiaryId_placeId_key" ON "BeneficiaryPlace"("beneficiaryId", "placeId");
CREATE INDEX "BeneficiaryPlace_tenantId_projectId_idx" ON "BeneficiaryPlace"("tenantId", "projectId");
CREATE INDEX "BeneficiaryPlace_tenantId_placeId_idx" ON "BeneficiaryPlace"("tenantId", "placeId");

CREATE TABLE "PlaceWordLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaceWordLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlaceWordLink_projectId_word_key" ON "PlaceWordLink"("projectId", "word");
CREATE INDEX "PlaceWordLink_tenantId_placeId_idx" ON "PlaceWordLink"("tenantId", "placeId");
