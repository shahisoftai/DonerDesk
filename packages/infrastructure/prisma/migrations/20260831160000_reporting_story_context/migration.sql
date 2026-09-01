-- Increment 2 — "Tell the Story" structured narrative context on a reporting period.
-- Additive: a new nullable-by-default JSON column; existing periods get empty context.
ALTER TABLE "ReportingPeriod" ADD COLUMN "storyContextJson" TEXT NOT NULL DEFAULT '{}';
