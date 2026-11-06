-- Phase 28.1-D: budget lines on planned activities and the expenses booked against them. Additive only.
-- Re-run infra/postgres/rls.sql afterwards (adds BudgetLine and BudgetExpense; RLS forced).
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "plannedActivityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "donorName" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BudgetLine_tenantId_plannedActivityId_idx" ON "BudgetLine"("tenantId", "plannedActivityId");
CREATE INDEX "BudgetLine_tenantId_projectId_idx" ON "BudgetLine"("tenantId", "projectId");

CREATE TABLE "BudgetExpense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetLineId" TEXT NOT NULL,
    "expenseDate" DATE NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetExpense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BudgetExpense_tenantId_budgetLineId_idx" ON "BudgetExpense"("tenantId", "budgetLineId");
CREATE INDEX "BudgetExpense_tenantId_projectId_idx" ON "BudgetExpense"("tenantId", "projectId");
