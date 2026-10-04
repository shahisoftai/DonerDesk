-- Financial figures for reports (finance data mode per project).
-- A project's reporting profile says how its reports get financial figures:
-- DISABLED (default, nothing changes), TYPED (entered per period) or IMPORT
-- (pasted spreadsheet rows). Both fill the same per-period summary.
ALTER TABLE "ReportingProfile" ADD COLUMN "financeDataMode" TEXT NOT NULL DEFAULT 'DISABLED';

CREATE TABLE "PeriodFinancialSummary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "expenditure" TEXT NOT NULL,
    "committed" TEXT,
    "linesJson" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL,
    "sourceNote" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodFinancialSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PeriodFinancialSummary_reportingPeriodId_key" ON "PeriodFinancialSummary"("reportingPeriodId");
CREATE INDEX "PeriodFinancialSummary_tenantId_idx" ON "PeriodFinancialSummary"("tenantId");
CREATE INDEX "PeriodFinancialSummary_projectId_idx" ON "PeriodFinancialSummary"("projectId");
