-- Finance register (Phase 35.F): funding sources, project funding, budget categories, disbursements, deliverables, advances, rates.
-- Additive. Amounts of the new tables are BIGINT minor units (a grant can exceed 2^31 cents). Existing expenses stay APPROVED.
-- Re-run infra/postgres/rls.sql afterwards (adds the eight new tables; RLS forced).
ALTER TABLE "Organization" ADD COLUMN "primaryCurrency" TEXT NOT NULL DEFAULT 'USD', ADD COLUMN "localCurrency" TEXT;
ALTER TABLE "BudgetLine" ADD COLUMN "fundingSourceId" TEXT;
ALTER TABLE "BudgetExpense"
  ADD COLUMN "vendor" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "currency" TEXT,
  ADD COLUMN "fundingSourceId" TEXT,
  ADD COLUMN "evidenceId" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "decidedById" TEXT,
  ADD COLUMN "decidedAt" TIMESTAMP(3),
  ADD COLUMN "decisionNote" TEXT;

CREATE TABLE "FundingSource" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "ownFunding" BOOLEAN NOT NULL DEFAULT true, "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FundingSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FundingSource_tenantId_name_key" ON "FundingSource"("tenantId", "name");
CREATE INDEX "FundingSource_tenantId_idx" ON "FundingSource"("tenantId");

CREATE TABLE "ProjectFunding" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "fundingSourceId" TEXT NOT NULL, "allocatedOn" DATE NOT NULL,
  "amountMinor" BIGINT NOT NULL, "currency" TEXT NOT NULL, "note" TEXT NOT NULL DEFAULT '', "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProjectFunding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectFunding_tenantId_projectId_idx" ON "ProjectFunding"("tenantId", "projectId");
CREATE INDEX "ProjectFunding_tenantId_fundingSourceId_idx" ON "ProjectFunding"("tenantId", "fundingSourceId");

CREATE TABLE "BudgetCategory" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "code" TEXT NOT NULL, "label" TEXT NOT NULL, "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BudgetCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BudgetCategory_tenantId_code_key" ON "BudgetCategory"("tenantId", "code");
CREATE INDEX "BudgetCategory_tenantId_idx" ON "BudgetCategory"("tenantId");

CREATE TABLE "Disbursement" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "fundingSourceId" TEXT NOT NULL, "paidOn" DATE NOT NULL,
  "amountMinor" BIGINT NOT NULL, "currency" TEXT NOT NULL, "memo" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "decidedById" TEXT, "decidedAt" TIMESTAMP(3), "decisionNote" TEXT, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Disbursement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Disbursement_tenantId_projectId_idx" ON "Disbursement"("tenantId", "projectId");
CREATE INDEX "Disbursement_tenantId_fundingSourceId_idx" ON "Disbursement"("tenantId", "fundingSourceId");

CREATE TABLE "Deliverable" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "name" TEXT NOT NULL, "amountMinor" BIGINT NOT NULL, "currency" TEXT NOT NULL,
  "dueOn" DATE NOT NULL, "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "paidOn" DATE, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Deliverable_tenantId_projectId_idx" ON "Deliverable"("tenantId", "projectId");

CREATE TABLE "Advance" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "heldBy" TEXT NOT NULL, "givenOn" DATE NOT NULL,
  "amountMinor" BIGINT NOT NULL, "currency" TEXT NOT NULL, "note" TEXT NOT NULL DEFAULT '', "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Advance_tenantId_projectId_idx" ON "Advance"("tenantId", "projectId");

CREATE TABLE "AdvanceAccounting" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "advanceId" TEXT NOT NULL, "accountedOn" DATE NOT NULL, "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL, "note" TEXT NOT NULL DEFAULT '', "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AdvanceAccounting_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdvanceAccounting_tenantId_advanceId_idx" ON "AdvanceAccounting"("tenantId", "advanceId");

CREATE TABLE "CurrencyRate" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "fromCurrency" TEXT NOT NULL, "toCurrency" TEXT NOT NULL, "rate" TEXT NOT NULL, "effectiveOn" DATE NOT NULL,
  "source" TEXT NOT NULL DEFAULT '', "enteredById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CurrencyRate_tenantId_fromCurrency_toCurrency_effectiveOn_idx" ON "CurrencyRate"("tenantId", "fromCurrency", "toCurrency", "effectiveOn");
