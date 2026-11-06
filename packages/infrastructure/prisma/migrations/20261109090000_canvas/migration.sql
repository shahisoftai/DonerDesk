-- A canvas (Phase 45): one saved page set of blocks, a dashboard when viewed live and an infographic when published. Additive.
CREATE TABLE "Canvas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "projectId" TEXT,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "docJson" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "sourceKind" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Canvas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Canvas_tenantId_sourceKind_sourceId_key" ON "Canvas"("tenantId", "sourceKind", "sourceId");
CREATE INDEX "Canvas_tenantId_scope_idx" ON "Canvas"("tenantId", "scope");
CREATE INDEX "Canvas_tenantId_ownerId_idx" ON "Canvas"("tenantId", "ownerId");
CREATE INDEX "Canvas_tenantId_projectId_idx" ON "Canvas"("tenantId", "projectId");
