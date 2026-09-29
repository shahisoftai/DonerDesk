-- Phase 22 WS-G: nonprofit discount verification
ALTER TABLE "Organization" ADD COLUMN "nonprofitVerifiedAt" TIMESTAMP(3);

CREATE TABLE "NonprofitVerification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NonprofitVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NonprofitVerification_tenantId_idx" ON "NonprofitVerification"("tenantId");
CREATE INDEX "NonprofitVerification_status_idx" ON "NonprofitVerification"("status");
