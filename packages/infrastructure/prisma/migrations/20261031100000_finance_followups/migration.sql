-- Finance follow-ups (Phase 35): the older budget tables get 64-bit amounts (a line above ~21 million overflowed a 32-bit column),
-- and an organisation can require a second person to decide finance entries. Additive / widening only.
ALTER TABLE "BudgetLine" ALTER COLUMN "amountMinor" TYPE BIGINT;
ALTER TABLE "BudgetExpense" ALTER COLUMN "amountMinor" TYPE BIGINT;
ALTER TABLE "Organization" ADD COLUMN "financeSeparateApprover" BOOLEAN NOT NULL DEFAULT false;
