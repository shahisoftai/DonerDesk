-- Context overlays for maps (rivers, roads, a camp outline): the organisation's own, ticked per map, never reported against (Phase 35). Additive.
CREATE TABLE "MapOverlay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "featureCount" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MapOverlay_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MapOverlay_tenantId_idx" ON "MapOverlay"("tenantId");
