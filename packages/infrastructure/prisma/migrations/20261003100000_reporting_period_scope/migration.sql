-- Ad-hoc report types (ACTIVITY / SITUATION / CUSTOM) carry a scope: which
-- activities, which event, or what title/purpose the report covers.
ALTER TABLE "ReportingPeriod" ADD COLUMN "scopeJson" TEXT NOT NULL DEFAULT '{}';
