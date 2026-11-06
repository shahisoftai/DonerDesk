-- Connectors from a collection form to KoboToolbox or SurveyCTO (Phase 33.7). Additive.
CREATE TABLE "DataConnector" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "serverUrl" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "fieldMapJson" TEXT NOT NULL DEFAULT '[]',
    "credentialEnc" TEXT,
    "cursor" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncJson" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataConnector_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataConnector_tenantId_formId_idx" ON "DataConnector"("tenantId", "formId");
