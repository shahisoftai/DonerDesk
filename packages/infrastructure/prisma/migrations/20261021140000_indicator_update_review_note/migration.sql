-- A reviewer's correction/rejection reason gets its own column. It used to be
-- written over IndicatorUpdate.comments, so the submitter's next save wiped it
-- and the reason could reach the report writer as if it were the officer's note.
ALTER TABLE "IndicatorUpdate" ADD COLUMN "reviewNote" TEXT;

-- Carry over reasons already stored in comments for rows that are still sent back.
UPDATE "IndicatorUpdate"
SET "reviewNote" = "comments"
WHERE "verificationStatus" IN ('NEEDS_CORRECTION', 'REJECTED') AND "comments" IS NOT NULL;

-- The reason had replaced the submitter's own note; that note is gone, so do not
-- leave the reviewer's text behind as if the officer had written it.
UPDATE "IndicatorUpdate"
SET "comments" = NULL
WHERE "verificationStatus" IN ('NEEDS_CORRECTION', 'REJECTED') AND "reviewNote" IS NOT NULL;
