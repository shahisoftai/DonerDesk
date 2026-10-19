-- Phase 28.1-G: beneficiary records by case code (no names). Additive only.
-- Re-run infra/postgres/rls.sql afterwards (adds Beneficiary; RLS forced).
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "enrolledOn" DATE NOT NULL,
    "consentRecordedById" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Beneficiary_projectId_caseCode_key" ON "Beneficiary"("projectId", "caseCode");
CREATE INDEX "Beneficiary_tenantId_projectId_idx" ON "Beneficiary"("tenantId", "projectId");
