-- An organisation's map context settings (Phase 49.6): which context layers its maps offer, and its own imagery address (off by default).
-- One row per organisation; no row = the default (nothing on). Additive.
CREATE TABLE "TenantMapSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantMapSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantMapSettings_tenantId_key" ON "TenantMapSettings"("tenantId");
