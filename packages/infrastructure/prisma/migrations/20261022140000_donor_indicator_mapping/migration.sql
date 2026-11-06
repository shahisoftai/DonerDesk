-- CreateTable
CREATE TABLE "DonorIndicatorMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "indicatorId" TEXT,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonorIndicatorMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DonorIndicatorMapping_templateId_requirementId_key" ON "DonorIndicatorMapping"("templateId", "requirementId");

-- CreateIndex
CREATE INDEX "DonorIndicatorMapping_tenantId_idx" ON "DonorIndicatorMapping"("tenantId");
