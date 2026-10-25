-- Saved infographics (Phase 31): the composition and its published exports. Two additive tables;
-- no existing column changes, applied before the code ships.
CREATE TABLE "ProjectInfographic" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "configJson" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectInfographic_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectInfographic_tenantId_projectId_idx" ON "ProjectInfographic"("tenantId", "projectId");

CREATE TABLE "InfographicExport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "infographicId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "provenanceJson" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfographicExport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InfographicExport_tenantId_projectId_infographicId_idx" ON "InfographicExport"("tenantId", "projectId", "infographicId");
