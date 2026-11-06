-- An organisation's own default pack for one sector (Phase 38). Additive.
CREATE TABLE "SetupDefaultPack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sectorKey" TEXT NOT NULL,
    "packJson" JSONB NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupDefaultPack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SetupDefaultPack_tenantId_sectorKey_key" ON "SetupDefaultPack"("tenantId", "sectorKey");
