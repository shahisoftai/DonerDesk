-- Infographic Studio v2 (Phase 32): review status on designs, richer exports, uploaded assets, brand kit,
-- saved layouts and public share links. All additive; apply before the code ships, then re-run rls.sql.
ALTER TABLE "ProjectInfographic"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "reviewRequestedById" TEXT,
  ADD COLUMN "reviewRequestedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "selfApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "parentId" TEXT;

ALTER TABLE "InfographicExport"
  ADD COLUMN "pageCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "waivedJson" TEXT,
  ADD COLUMN "altText" TEXT;

CREATE TABLE "InfographicAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "credit" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "InfographicAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InfographicAsset_tenantId_kind_idx" ON "InfographicAsset"("tenantId", "kind");

CREATE TABLE "InfographicBrandKit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandJson" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InfographicBrandKit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InfographicBrandKit_tenantId_key" ON "InfographicBrandKit"("tenantId");

CREATE TABLE "InfographicUserTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseTemplateId" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InfographicUserTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InfographicUserTemplate_tenantId_idx" ON "InfographicUserTemplate"("tenantId");

CREATE TABLE "InfographicShareLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "infographicId" TEXT NOT NULL,
    "exportId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InfographicShareLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InfographicShareLink_tokenHash_key" ON "InfographicShareLink"("tokenHash");
CREATE INDEX "InfographicShareLink_tenantId_infographicId_idx" ON "InfographicShareLink"("tenantId", "infographicId");
