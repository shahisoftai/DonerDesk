-- Phase 54 datasets: a table a person brings (upload, connector, form records), its immutable versions, their rows (jsonb with the
-- place and period resolved at save time) and links that feed indicators as drafts. Additive; row-level security is applied by rls.sql.
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kitKey" TEXT,
    "kitMappingJson" TEXT NOT NULL DEFAULT '{}',
    "currentVersionId" TEXT,
    "sharePolicyJson" TEXT NOT NULL DEFAULT '{"hidden":[]}',
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "restrictionJson" TEXT,
    "connectorJson" TEXT,
    "connectorSecretEnc" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Dataset_tenantId_projectId_idx" ON "Dataset"("tenantId", "projectId");

CREATE TABLE "DatasetVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "columnsJson" TEXT NOT NULL,
    "stepsJson" TEXT NOT NULL DEFAULT '[]',
    "figuresJson" TEXT NOT NULL DEFAULT '[]',
    "checksJson" TEXT NOT NULL DEFAULT '[]',
    "rowCount" INTEGER NOT NULL,
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileHash" TEXT,
    "findingsJson" TEXT NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DatasetVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DatasetVersion_tenantId_datasetId_idx" ON "DatasetVersion"("tenantId", "datasetId");

CREATE TABLE "DatasetRow" (
    "tenantId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "rowNo" INTEGER NOT NULL,
    "placeId" TEXT,
    "periodKey" TEXT,
    "valuesJson" JSONB NOT NULL,
    CONSTRAINT "DatasetRow_pkey" PRIMARY KEY ("versionId", "rowNo")
);
CREATE INDEX "DatasetRow_versionId_placeId_periodKey_idx" ON "DatasetRow"("versionId", "placeId", "periodKey");

CREATE TABLE "DatasetIndicatorLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "figureRef" TEXT NOT NULL,
    "filterJson" TEXT NOT NULL DEFAULT '[]',
    "byPlace" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncJson" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DatasetIndicatorLink_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DatasetIndicatorLink_tenantId_datasetId_idx" ON "DatasetIndicatorLink"("tenantId", "datasetId");
CREATE INDEX "DatasetIndicatorLink_tenantId_indicatorId_idx" ON "DatasetIndicatorLink"("tenantId", "indicatorId");
