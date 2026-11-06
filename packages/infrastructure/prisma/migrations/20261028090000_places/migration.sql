-- Places (Phase 33.1): the organisation's own list of where it works. Additive.
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "adminLevel" INTEGER NOT NULL,
    "parentId" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "code" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Place_tenantId_parentId_idx" ON "Place"("tenantId", "parentId");
CREATE INDEX "Place_tenantId_archivedAt_idx" ON "Place"("tenantId", "archivedAt");
