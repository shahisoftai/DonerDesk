-- Phase 28.5: reminders without setup. Additive only. Re-run infra/postgres/rls.sql afterwards.
ALTER TABLE "User" ADD COLUMN "emailSummaryMode" TEXT NOT NULL DEFAULT 'DAILY_SUMMARY';
ALTER TABLE "Organization" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'UTC';

CREATE TABLE "ReminderLedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "sentOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReminderLedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReminderLedgerEntry_tenantId_recipientId_subjectKey_ruleKey_sentOn_key" ON "ReminderLedgerEntry"("tenantId", "recipientId", "subjectKey", "ruleKey", "sentOn");
CREATE INDEX "ReminderLedgerEntry_tenantId_recipientId_subjectKey_idx" ON "ReminderLedgerEntry"("tenantId", "recipientId", "subjectKey");
