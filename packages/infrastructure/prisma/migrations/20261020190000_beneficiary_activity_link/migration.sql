-- Gap closure: the people (by case code) an activity reached. Additive only.
-- Re-run infra/postgres/rls.sql afterwards (adds BeneficiaryActivityLink; RLS forced).
CREATE TABLE "BeneficiaryActivityLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "plannedActivityId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BeneficiaryActivityLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BeneficiaryActivityLink_plannedActivityId_beneficiaryId_key" ON "BeneficiaryActivityLink"("plannedActivityId", "beneficiaryId");
CREATE INDEX "BeneficiaryActivityLink_tenantId_beneficiaryId_idx" ON "BeneficiaryActivityLink"("tenantId", "beneficiaryId");
