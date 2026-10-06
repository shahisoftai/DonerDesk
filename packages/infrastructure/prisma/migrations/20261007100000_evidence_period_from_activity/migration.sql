-- Evidence documents an activity and now inherits that activity's reporting period (EvidenceLinkService).
-- Backfill (idempotent, data only, no schema change): files that are attached to an activity but carry no
-- period of their own take the activity's. A file that already has a period is never touched.
UPDATE "EvidenceFile" e
SET "reportingPeriodId" = a."reportingPeriodId"
FROM "ActivityUpdate" a
WHERE a."id" = e."activityId"
  AND a."tenantId" = e."tenantId"
  AND e."reportingPeriodId" IS NULL;
