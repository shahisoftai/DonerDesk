-- Phase 25: summary acknowledgement, per-type default templates, second-approver rule, standing statements, attestation owner.
ALTER TABLE "ReportSection" ADD COLUMN IF NOT EXISTS "summaryCurrentAt" TIMESTAMP(3);
ALTER TABLE "ReportingProfile" ADD COLUMN IF NOT EXISTS "defaultTemplateByTypeJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "ReportingProfile" ADD COLUMN IF NOT EXISTS "requireSecondApprover" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReportingProfile" ADD COLUMN IF NOT EXISTS "standingStatementsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "ChecklistItem" ADD COLUMN IF NOT EXISTS "attestedById" TEXT;
