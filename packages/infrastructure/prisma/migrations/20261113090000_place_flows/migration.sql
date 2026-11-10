-- Movements between two places of a project: what moved, how much, in what unit (Phase 48.12). Additive.
CREATE TABLE "PlaceFlow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromPlaceId" TEXT NOT NULL,
    "toPlaceId" TEXT NOT NULL,
    "what" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaceFlow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlaceFlow_tenantId_projectId_idx" ON "PlaceFlow"("tenantId", "projectId");
