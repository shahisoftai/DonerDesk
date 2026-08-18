-- Tier management: global plan catalog overrides written by the SuperAdmin
-- portal. Null columns keep the static catalog value; limitsJson is a JSON
-- PlanLimitsJson (partial or full) merged on top of the static catalog.

-- CreateTable
CREATE TABLE "PlanCatalogOverride" (
    "planCode" TEXT NOT NULL,
    "name" TEXT,
    "monthlyPriceUsd" INTEGER,
    "annualPriceUsd" INTEGER,
    "trialDays" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limitsJson" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanCatalogOverride_pkey" PRIMARY KEY ("planCode")
);

-- CreateIndex
CREATE INDEX "PlanCatalogOverride_enabled_idx" ON "PlanCatalogOverride"("enabled");
