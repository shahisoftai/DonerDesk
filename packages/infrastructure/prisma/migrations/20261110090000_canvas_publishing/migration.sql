-- Canvas publishing (Phase 45): saved copies of exports, share links, version history, review state, snapshot schedule and the canvas-AI switch. Additive.
ALTER TABLE "Canvas" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Canvas" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "Canvas" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "Canvas" ADD COLUMN "snapshotEvery" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Canvas" ADD COLUMN "lastSnapshotAt" TIMESTAMP(3);
ALTER TABLE "Canvas" ADD COLUMN "snapshotActor" TEXT;
ALTER TABLE "Organization" ADD COLUMN "canvasAiEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "CanvasExport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "provenanceJson" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CanvasExport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CanvasExport_tenantId_canvasId_idx" ON "CanvasExport"("tenantId", "canvasId");

CREATE TABLE "CanvasShareLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "exportId" TEXT,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CanvasShareLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CanvasShareLink_tokenHash_key" ON "CanvasShareLink"("tokenHash");
CREATE INDEX "CanvasShareLink_tenantId_canvasId_idx" ON "CanvasShareLink"("tenantId", "canvasId");

CREATE TABLE "CanvasVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "docJson" TEXT NOT NULL,
    "savedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CanvasVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CanvasVersion_canvasId_revision_key" ON "CanvasVersion"("canvasId", "revision");
CREATE INDEX "CanvasVersion_tenantId_canvasId_idx" ON "CanvasVersion"("tenantId", "canvasId");
