-- Optional window for entering a period's values (Phase 33.4). Plain days as text (YYYY-MM-DD). Additive.
ALTER TABLE "ReportingPeriod" ADD COLUMN "entryOpensOn" TEXT;
ALTER TABLE "ReportingPeriod" ADD COLUMN "entryClosesOn" TEXT;
