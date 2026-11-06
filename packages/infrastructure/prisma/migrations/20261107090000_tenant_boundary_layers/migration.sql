-- Phase 41.7: boundary files an organisation uploads for one country and one admin level. A new table; nothing existing changes.
CREATE TABLE "TenantBoundaryLayer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "iso" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "adminLevel" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameField" TEXT NOT NULL,
    "pcodeField" TEXT,
    "parentPcodeField" TEXT,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "featureCount" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantBoundaryLayer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TenantBoundaryLayer_tenantId_idx" ON "TenantBoundaryLayer"("tenantId");

CREATE UNIQUE INDEX "TenantBoundaryLayer_tenantId_iso_adminLevel_key" ON "TenantBoundaryLayer"("tenantId", "iso", "adminLevel");
