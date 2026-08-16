-- Feature: Spreadsheet-style indicator data entry
-- One IndicatorUpdate per (indicator, reporting period). Deduplicate any
-- pre-existing duplicate rows (keep the earliest), then enforce uniqueness so
-- bulk upserts can rely on find-or-create semantics.

-- Step 1: Deduplicate pre-existing rows, keeping the earliest per
-- (tenantId, indicatorId, reportingPeriodId).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "indicatorId", "reportingPeriodId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "IndicatorUpdate"
)
DELETE FROM "IndicatorUpdate"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: Enforce uniqueness for the data-entry grid.
CREATE UNIQUE INDEX "IndicatorUpdate_tenantId_indicatorId_reportingPeriodId_key"
  ON "IndicatorUpdate"("tenantId", "indicatorId", "reportingPeriodId");
