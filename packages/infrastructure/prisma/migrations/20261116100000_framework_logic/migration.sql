-- Phase 52.1: the logframe's assumptions and the results framework's rationale, per result. Additive and nullable.
ALTER TABLE "LogframeItem" ADD COLUMN "assumptions" TEXT;
ALTER TABLE "LogframeItem" ADD COLUMN "rationale" TEXT;
-- A problem or risk may be raised against a result.
ALTER TABLE "ProjectRisk" ADD COLUMN "logframeItemId" TEXT;
