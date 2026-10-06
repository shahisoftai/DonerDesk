-- Phase 25.6: a period can be cancelled (its data stays) and restored; it leaves the calendar while cancelled.
ALTER TABLE "ReportingPeriod" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "ReportingPeriod" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
