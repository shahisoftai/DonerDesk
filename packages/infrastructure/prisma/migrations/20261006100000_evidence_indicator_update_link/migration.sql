-- One evidence concept: EvidenceFile.indicatorId meant two things (an indicator's id when a file was
-- tagged, an IndicatorUpdate's id when it was attached). The update link gets its own column.
ALTER TABLE "EvidenceFile" ADD COLUMN "indicatorUpdateId" TEXT;
CREATE INDEX "EvidenceFile_indicatorUpdateId_idx" ON "EvidenceFile"("indicatorUpdateId");

-- Backfill (idempotent): a legacy indicatorId that is really an IndicatorUpdate id moves to the new
-- column and indicatorId becomes that update's indicator. Rows holding a real indicator id are untouched.
UPDATE "EvidenceFile" e
SET "indicatorUpdateId" = e."indicatorId",
    "indicatorId" = u."indicatorId"
FROM "IndicatorUpdate" u
WHERE u."id" = e."indicatorId"
  AND u."tenantId" = e."tenantId"
  AND e."indicatorUpdateId" IS NULL;
