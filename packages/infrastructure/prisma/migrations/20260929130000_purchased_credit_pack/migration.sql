-- Phase 22 WS-D: AI credit top-up packs
CREATE TABLE "PurchasedCreditPack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "providerOrderId" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchasedCreditPack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchasedCreditPack_providerOrderId_key" ON "PurchasedCreditPack"("providerOrderId");
CREATE INDEX "PurchasedCreditPack_tenantId_status_idx" ON "PurchasedCreditPack"("tenantId", "status");
