-- Map layers and pinned sites (Phase 30.1): a workspace can upload its own boundaries, and an
-- activity can carry a hand-placed coordinate when no gazetteer name matches.
ALTER TABLE "PlannedActivity" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "PlannedActivity" ADD COLUMN "longitude" DOUBLE PRECISION;

CREATE TABLE "TenantMapLayer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "featureCount" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMapLayer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantMapLayer_tenantId_key" ON "TenantMapLayer"("tenantId");
CREATE INDEX "TenantMapLayer_tenantId_idx" ON "TenantMapLayer"("tenantId");
